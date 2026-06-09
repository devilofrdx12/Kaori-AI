import { getDb } from "./db";

const DAILY_LIMIT = parseFloat(process.env.DAILY_SPEND_LIMIT_USD || "2.00");

/**
 * Check if user has budget remaining for this request.
 * Throws a 429 Response if daily limit exceeded.
 */
export function checkSpend(userId: string, estimatedCostUsd: number): void {
  const db = getDb();
  const user = db
    .prepare(
      "SELECT daily_spend_usd, spend_reset_date FROM users WHERE id = ?"
    )
    .get(userId) as {
    daily_spend_usd: number;
    spend_reset_date: number;
  };

  if (!user) return;

  const today = Math.floor(Date.now() / 1000 / 86400);

  // Reset daily counter if day rolled over
  if (user.spend_reset_date < today) {
    db.prepare(
      "UPDATE users SET daily_spend_usd = 0, spend_reset_date = ? WHERE id = ?"
    ).run(today, userId);
    user.daily_spend_usd = 0;
  }

  if (user.daily_spend_usd + estimatedCostUsd > DAILY_LIMIT) {
    throw new Response(
      JSON.stringify({
        error: `Daily spend limit ($${DAILY_LIMIT.toFixed(2)}) reached. Resets tomorrow.`,
      }),
      {
        status: 429,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

/**
 * Record actual API spend after a successful call.
 */
export function recordSpend(userId: string, actualCostUsd: number): void {
  const db = getDb();
  db.prepare(
    "UPDATE users SET daily_spend_usd = daily_spend_usd + ? WHERE id = ?"
  ).run(actualCostUsd, userId);
}
