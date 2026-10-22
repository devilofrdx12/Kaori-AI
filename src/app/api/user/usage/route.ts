import { NextRequest, NextResponse } from "next/server";
import { getDb, mapRows } from "../../lib/db";
import { getSessionUser, requireAjax } from "../../lib/auth-utils";
import { logger } from "../../lib/logger";

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
    try {
      requireAjax(req);
    } catch (err) {
      if (err instanceof Response) return err;
      return NextResponse.json({ error: "CSRF check failed" }, { status: 403 });
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

    // Align daily boundary to UTC midnight (matching spend-guard.ts)
    const now = new Date();
    const todayStart = Math.floor(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 1000
    );

    // Count today's direct user messages (excluding tool_result continuation turns where tool_use_id is set)
    const msgResult = await db.execute({
      sql: `SELECT COUNT(*) as count FROM messages m
            JOIN conversations c ON m.conversation_id = c.id
            WHERE c.user_id = ? AND m.role = 'user' AND m.tool_use_id IS NULL AND m.created_at >= ?`,
      args: [sessionUser.id, todayStart],
    });
    const messagesCount = Number(mapRows<{ count: number }>(msgResult)[0]?.count || 0);

    // Count total tool uses today from QUARTZWALL tool policy logs and tool messages
    const toolResult = await db.execute({
      sql: `SELECT COUNT(*) as count FROM quartzwall_events
            WHERE user_id = ? AND type = 'TOOL_CALL_POLICY' AND verdict != 'BLOCKED' AND created_at >= ?`,
      args: [sessionUser.id, todayStart],
    });
    const toolsUsed = Number(mapRows<{ count: number }>(toolResult)[0]?.count || 0);

    const dailyLimit = parseFloat(process.env.DAILY_SPEND_LIMIT_USD || "2.00");

    // Reset spend if day rolled over
    let dailySpend = typeof user.daily_spend_usd === "number" ? user.daily_spend_usd : 0;
    if (!user.spend_reset_date || user.spend_reset_date < todayStart) {
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
  } catch (err) {
    logger.error({ err }, "[GET /api/user/usage] Error");
    return NextResponse.json(
      { error: "Failed to load usage data" },
      { status: 500 }
    );
  }
}
