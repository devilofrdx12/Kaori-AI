import { getDb, mapRows } from "./db";

function readPositiveUsdEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const DAILY_LIMIT = readPositiveUsdEnv("DAILY_SPEND_LIMIT_USD", 2.0);
const CHAT_REQUEST_RESERVE_USD = readPositiveUsdEnv("CHAT_REQUEST_RESERVE_USD", 0.1);

function startOfCurrentUtcDay() {
  const now = new Date();
  return Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 1000);
}

function spendLimitResponse() {
  return new Error(`Daily spend limit ($${DAILY_LIMIT.toFixed(2)}) reached. Resets tomorrow.`);
}

/**
 * Check if user has budget remaining for this request.
 * Throws a 429 Response if daily limit exceeded.
 */
export async function checkSpend(
  userId: string,
  estimatedCostUsd: number
): Promise<void> {
  const db = await getDb();
  const rows = mapRows<{
    daily_spend_usd: number;
    spend_reset_date: number;
    is_pro: number;
  }>(await db.execute({
    sql: "SELECT daily_spend_usd, spend_reset_date, is_pro FROM users WHERE id = ?",
    args: [userId],
  }));
  const user = rows[0];

  if (!user) return;
  if (user.is_pro === 1) return;

  const today = startOfCurrentUtcDay();

  // Reset daily counter if day rolled over
  if (user.spend_reset_date < today) {
    await db.execute({
      sql: "UPDATE users SET daily_spend_usd = 0, spend_reset_date = ? WHERE id = ?",
      args: [today, userId],
    });
    user.daily_spend_usd = 0;
  }

  if (user.daily_spend_usd + estimatedCostUsd > DAILY_LIMIT) {
    throw spendLimitResponse();
  }
}

/**
 * Atomically reserves budget before a provider call. This prevents concurrent
 * streams from all passing a read-then-write spend check and exceeding the cap.
 */
export async function reserveSpend(userId: string, estimatedCostUsd: number): Promise<void> {
  if (!Number.isFinite(estimatedCostUsd) || estimatedCostUsd <= 0) return;

  const db = await getDb();
  const today = startOfCurrentUtcDay();

  await db.execute({
    sql: `UPDATE users
          SET daily_spend_usd = 0, spend_reset_date = ?
          WHERE id = ? AND spend_reset_date < ?`,
    args: [today, userId, today],
  });

  const result = await db.execute({
    sql: `UPDATE users
          SET daily_spend_usd = daily_spend_usd + ?
          WHERE id = ? AND (is_pro = 1 OR daily_spend_usd + ? <= ?)`,
    args: [estimatedCostUsd, userId, estimatedCostUsd, DAILY_LIMIT],
  });

  if (result.rowsAffected !== 1) {
    throw spendLimitResponse();
  }
}

export async function reserveChatSpend(userId: string): Promise<void> {
  await reserveSpend(userId, Math.min(CHAT_REQUEST_RESERVE_USD, DAILY_LIMIT));
}

/**
 * Atomically refunds budget if a stream fails or aborts early.
 */
export async function refundSpend(userId: string, refundAmountUsd: number): Promise<void> {
  if (!Number.isFinite(refundAmountUsd) || refundAmountUsd <= 0) return;

  const db = await getDb();
  await db.execute({
    sql: `UPDATE users
          SET daily_spend_usd = MAX(0, daily_spend_usd - ?)
          WHERE id = ?`,
    args: [refundAmountUsd, userId],
  });
}

export async function refundChatSpend(userId: string): Promise<void> {
  await refundSpend(userId, Math.min(CHAT_REQUEST_RESERVE_USD, DAILY_LIMIT));
}

/**
 * Record actual API spend after a successful call.
 */
export async function recordSpend(
  userId: string,
  actualCostUsd: number
): Promise<void> {
  if (!Number.isFinite(actualCostUsd) || actualCostUsd <= 0) return;

  const db = await getDb();
  await db.execute({
    sql: "UPDATE users SET daily_spend_usd = daily_spend_usd + ? WHERE id = ?",
    args: [actualCostUsd, userId],
  });
}

/**
 * Approximate cost-per-1K-output-tokens by model family.
 * These are conservative estimates (output tokens are more expensive than input).
 * Input cost is not tracked here — the reserve covers the input side roughly.
 *
 * Rates are intentionally rounded up to avoid under-counting.
 */
const MODEL_COST_PER_1K_OUTPUT: Record<string, number> = {
  // Gemini
  "gemini-2.5-flash": 0.0004,
  "gemini-2.5-pro": 0.01,
  "gemini-": 0.001,            // fallback for other gemini models

  // Groq-hosted (free/cheap inference, but we still count it)
  "llama-": 0.0003,
  "mixtral-": 0.0003,
  "meta-llama/": 0.0003,
  "openai/": 0.0005,
  "qwen/": 0.0003,

  // Nvidia NIM / DeepSeek
  "nvidia/": 0.001,
  "z-ai/": 0.001,
  "deepseek-ai/": 0.0014,
  "deepseek": 0.0014,          // catch-all for deepseek variants
};

/**
 * Estimate the cost of a chat completion based on model and output length.
 * Uses character count / 4 as a rough token estimate.
 */
export function estimateChatCostUsd(
  model: string,
  outputChars: number
): number {
  // Find the most specific matching rate (longest prefix match).
  let rate = 0.001; // conservative fallback: $1/M output tokens
  let bestMatchLength = 0;

  for (const [prefix, cost] of Object.entries(MODEL_COST_PER_1K_OUTPUT)) {
    if (model.startsWith(prefix) && prefix.length > bestMatchLength) {
      rate = cost;
      bestMatchLength = prefix.length;
    }
  }

  // ~4 chars per token is a reasonable average across models.
  const estimatedTokens = Math.max(1, outputChars / 4);
  return (estimatedTokens / 1000) * rate;
}
