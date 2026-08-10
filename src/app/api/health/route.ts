import { getDb } from "../lib/db";
import { logger } from "../lib/logger";

// Health check endpoint — UptimeRobot / Vercel pings this
export async function GET() {
  try {
    const db = await getDb();
    await db.execute("SELECT 1");
    return Response.json({
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ error }, "Health check failed");
    return Response.json({ status: "down" }, { status: 503 });
  }
}
