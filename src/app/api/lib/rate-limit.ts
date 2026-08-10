import { getDb, mapRows } from "./db";

type RateLimitResult = { allowed: boolean; retryAfterSec: number };

async function consumeRateLimit(
  userId: string,
  bucket: string,
  windowSeconds: number,
  maximum: number
): Promise<RateLimitResult> {
  const db = await getDb();
  const now = Math.floor(Date.now() / 1000);
  const resetBefore = now - windowSeconds;
  const result = await db.execute({
    sql: `INSERT INTO rate_limits (user_id, bucket, count, window_start)
      VALUES (?, ?, 1, ?)
      ON CONFLICT(user_id, bucket) DO UPDATE SET
        count = CASE
          WHEN rate_limits.window_start <= ? THEN 1
          ELSE rate_limits.count + 1
        END,
        window_start = CASE
          WHEN rate_limits.window_start <= ? THEN excluded.window_start
          ELSE rate_limits.window_start
        END
      RETURNING count, window_start`,
    args: [userId, bucket, now, resetBefore, resetBefore],
  });
  const row = mapRows<{ count: number; window_start: number }>(result)[0];
  if (!row) throw new Error("Rate limiter failed to return its updated state");
  return {
    allowed: row.count <= maximum,
    retryAfterSec: row.count <= maximum
      ? 0
      : Math.max(0, row.window_start + windowSeconds - now),
  };
}

/** Five attempts per fifteen minutes for an anonymous security bucket. */
export async function checkAuthRateLimit(
  bucket: string
): Promise<{ allowed: boolean; retryAfterMs: number }> {
  const result = await consumeRateLimit("anonymous", bucket, 15 * 60, 5);
  return { allowed: result.allowed, retryAfterMs: result.retryAfterSec * 1000 };
}

/** Per-user chat ceiling; paid users receive a higher but finite allowance. */
export function checkChatRateLimit(userId: string, isPro = false) {
  return consumeRateLimit(userId, "chat", 60, isPro ? 60 : 20);
}

/** Independently limits directly reachable web/tool endpoints. */
export function checkToolRateLimit(userId: string, isPro = false) {
  return consumeRateLimit(userId, "tool", 60, isPro ? 90 : 30);
}

/** Five password-reset attempts per hour for each IP/account bucket. */
export function checkPasswordResetRateLimit(bucket: string) {
  return consumeRateLimit("anonymous", bucket, 60 * 60, 5);
}
