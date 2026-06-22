import { getDb, mapRows } from "./db";

/**
 * SQLite-backed rate limiting — survives restarts and redeploys.
 * Uses the rate_limits table with (user_id, bucket) primary key.
 */

/**
 * Auth rate limit: 5 attempts per 15 minutes per IP.
 */
export async function checkAuthRateLimit(
  ip: string
): Promise<{ allowed: boolean; retryAfterMs: number }> {
  const db = await getDb();
  const now = Math.floor(Date.now() / 1000);
  const WINDOW = 15 * 60; // 15 minutes
  const MAX = 5;
  const windowStart = now - WINDOW;

  const rows = mapRows<{ count: number; window_start: number }>(await db.execute(
    {
      sql: `SELECT count, window_start FROM rate_limits
            WHERE user_id = ? AND bucket = 'auth' AND window_start > ?`,
      args: [ip, windowStart],
    }
  ));
  const row = rows[0];

  if (!row) {
    await db.execute({
      sql: `INSERT OR REPLACE INTO rate_limits (user_id, bucket, count, window_start)
            VALUES (?, 'auth', 1, ?)`,
      args: [ip, now],
    });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (row.count >= MAX) {
    const retryAfterMs = (row.window_start + WINDOW - now) * 1000;
    return { allowed: false, retryAfterMs: Math.max(retryAfterMs, 0) };
  }

  await db.execute({
    sql: `UPDATE rate_limits SET count = count + 1
          WHERE user_id = ? AND bucket = 'auth'`,
    args: [ip],
  });
  return { allowed: true, retryAfterMs: 0 };
}

/**
 * Chat rate limit: 20 messages per minute per user.
 */
export async function checkChatRateLimit(
  userId: string,
  isPro: boolean = false
): Promise<{ allowed: boolean; retryAfterSec: number }> {
  if (isPro) {
    return { allowed: true, retryAfterSec: 0 };
  }
  
  const db = await getDb();
  const now = Math.floor(Date.now() / 1000);
  const WINDOW = 60; // 1 minute
  const MAX = 20;

  const rows = mapRows<{ count: number; window_start: number }>(await db.execute({
    sql: `SELECT count, window_start FROM rate_limits
          WHERE user_id = ? AND bucket = 'chat'`,
    args: [userId],
  }));
  const row = rows[0];

  if (!row || now - row.window_start > WINDOW) {
    await db.execute({
      sql: `INSERT OR REPLACE INTO rate_limits (user_id, bucket, count, window_start)
            VALUES (?, 'chat', 1, ?)`,
      args: [userId, now],
    });
    return { allowed: true, retryAfterSec: 0 };
  }

  if (row.count >= MAX) {
    return {
      allowed: false,
      retryAfterSec: WINDOW - (now - row.window_start),
    };
  }

  await db.execute({
    sql: `UPDATE rate_limits SET count = count + 1
          WHERE user_id = ? AND bucket = 'chat'`,
    args: [userId],
  });
  return { allowed: true, retryAfterSec: 0 };
}

/**
 * Password reset rate limit: 5 requests per hour.
 */
export async function checkPasswordResetRateLimit(
  bucket: string
): Promise<{ allowed: boolean; retryAfterSec: number }> {
  const db = await getDb();
  const now = Math.floor(Date.now() / 1000);
  const WINDOW = 3600; // 1 hour
  const MAX = 5;

  const rows = mapRows<{ count: number; window_start: number }>(await db.execute({
    sql: `SELECT count, window_start FROM rate_limits
          WHERE user_id = 'anonymous' AND bucket = ?`,
    args: [bucket],
  }));
  const row = rows[0];

  if (!row || now - row.window_start > WINDOW) {
    await db.execute({
      sql: `INSERT OR REPLACE INTO rate_limits (user_id, bucket, count, window_start)
            VALUES ('anonymous', ?, 1, ?)`,
      args: [bucket, now],
    });
    return { allowed: true, retryAfterSec: 0 };
  }

  if (row.count >= MAX) {
    return {
      allowed: false,
      retryAfterSec: WINDOW - (now - row.window_start),
    };
  }

  await db.execute({
    sql: `UPDATE rate_limits SET count = count + 1
          WHERE user_id = 'anonymous' AND bucket = ?`,
    args: [bucket],
  });
  return { allowed: true, retryAfterSec: 0 };
}
