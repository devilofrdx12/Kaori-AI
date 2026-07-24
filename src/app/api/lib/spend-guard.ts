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
  }>(await db.execute({
    sql: "SELECT daily_spend_usd, spend_reset_date FROM users WHERE id = ?",
    args: [userId],
  }));
  const user = rows[0];

  if (!user) return;

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
          WHERE id = ? AND daily_spend_usd + ? <= ?`,
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
  const db = await getDb();
  await db.execute({
    sql: "UPDATE users SET daily_spend_usd = daily_spend_usd + ? WHERE id = ?",
    args: [actualCostUsd, userId],
  });
}
