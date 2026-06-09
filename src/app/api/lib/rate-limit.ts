import { getDb } from "./db";

/**
 * SQLite-backed rate limiting — survives restarts and redeploys.
 * Uses the rate_limits table with (user_id, bucket) primary key.
 */

/**
 * Auth rate limit: 5 attempts per 15 minutes per IP.
 */
export function checkAuthRateLimit(
  ip: string
): { allowed: boolean; retryAfterMs: number } {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  const WINDOW = 15 * 60; // 15 minutes
  const MAX = 5;
  const windowStart = now - WINDOW;

  const row = db
    .prepare(
      `SELECT count, window_start FROM rate_limits
       WHERE user_id = ? AND bucket = 'auth' AND window_start > ?`
    )
    .get(ip, windowStart) as
    | { count: number; window_start: number }
    | undefined;

  if (!row) {
    db.prepare(
      `INSERT OR REPLACE INTO rate_limits (user_id, bucket, count, window_start)
       VALUES (?, 'auth', 1, ?)`
    ).run(ip, now);
    return { allowed: true, retryAfterMs: 0 };
  }

  if (row.count >= MAX) {
    const retryAfterMs = (row.window_start + WINDOW - now) * 1000;
    return { allowed: false, retryAfterMs: Math.max(retryAfterMs, 0) };
  }

  db.prepare(
    `UPDATE rate_limits SET count = count + 1
     WHERE user_id = ? AND bucket = 'auth'`
  ).run(ip);
  return { allowed: true, retryAfterMs: 0 };
}

/**
 * Chat rate limit: 20 messages per minute per user.
 */
export function checkChatRateLimit(
  userId: string
): { allowed: boolean; retryAfterSec: number } {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  const WINDOW = 60; // 1 minute
  const MAX = 20;

  const row = db
    .prepare(
      `SELECT count, window_start FROM rate_limits
       WHERE user_id = ? AND bucket = 'chat'`
    )
    .get(userId) as
    | { count: number; window_start: number }
    | undefined;

  if (!row || now - row.window_start > WINDOW) {
    db.prepare(
      `INSERT OR REPLACE INTO rate_limits (user_id, bucket, count, window_start)
       VALUES (?, 'chat', 1, ?)`
    ).run(userId, now);
    return { allowed: true, retryAfterSec: 0 };
  }

  if (row.count >= MAX) {
    return {
      allowed: false,
      retryAfterSec: WINDOW - (now - row.window_start),
    };
  }

  db.prepare(
    `UPDATE rate_limits SET count = count + 1
     WHERE user_id = ? AND bucket = 'chat'`
  ).run(userId);
  return { allowed: true, retryAfterSec: 0 };
}
