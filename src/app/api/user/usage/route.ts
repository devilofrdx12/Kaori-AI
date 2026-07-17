import { NextRequest, NextResponse } from "next/server";
import { getDb, mapRows } from "../../lib/db";
import { getSessionUser, requireAjax } from "../../lib/auth-utils";

type UserRow = {
  daily_spend_usd: number;
  spend_reset_date: number;
  is_pro: number;
};

/**
 * GET /api/user/usage — fetch real usage stats for the current user
 */
export async function GET(req: NextRequest) {
  try {
    requireAjax(req);
  } catch (err) {
    if (err instanceof Response) return err;
  }

  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDb();

  // Get user spend data
  const userResult = await db.execute({
    sql: "SELECT daily_spend_usd, spend_reset_date, is_pro FROM users WHERE id = ?",
    args: [sessionUser.id],
  });
  const user = mapRows<UserRow>(userResult)[0];

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Count today's messages
  const todayStart = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);
  const msgResult = await db.execute({
    sql: `SELECT COUNT(*) as count FROM messages m
          JOIN conversations c ON m.conversation_id = c.id
          WHERE c.user_id = ? AND m.role = 'user' AND m.created_at >= ?`,
    args: [sessionUser.id, todayStart],
  });
  const messagesCount = mapRows<{ count: number }>(msgResult)[0]?.count || 0;

  // Count total tool uses today (messages with role = 'tool')
  const toolResult = await db.execute({
    sql: `SELECT COUNT(*) as count FROM messages m
          JOIN conversations c ON m.conversation_id = c.id
          WHERE c.user_id = ? AND m.role = 'tool' AND m.created_at >= ?`,
    args: [sessionUser.id, todayStart],
  });
  const toolsUsed = mapRows<{ count: number }>(toolResult)[0]?.count || 0;

  const dailyLimit = parseFloat(process.env.DAILY_SPEND_LIMIT_USD || "2.00");

  // Reset spend if day rolled over
  const now = new Date();
  const today = Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 1000);
  let dailySpend = user.daily_spend_usd;
  if (user.spend_reset_date < today) {
    dailySpend = 0;
  }

  return NextResponse.json({
    messagesToday: messagesCount,
    dailySpendUsd: dailySpend,
    dailyLimitUsd: dailyLimit,
    toolsUsed,
    isPro: user.is_pro === 1,
    messageLimit: user.is_pro === 1 ? null : 100,
  });
}
