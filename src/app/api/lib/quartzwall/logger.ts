import { v4 as uuid } from "uuid";
import { getDb, mapRows } from "../db";
import { logger } from "../logger";
import type {
  QuartzwallEvent,
  QuartzwallEventType,
  QuartzwallSignal,
  QuartzwallStats,
  QuartzwallVerdict,
} from "./types";

type EventRow = {
  id: string;
  user_id: string;
  type: QuartzwallEventType;
  verdict: QuartzwallVerdict;
  risk: number;
  reason: string;
  tool_name: string | null;
  signals_json: string;
  metadata_json: string;
  created_at: number;
};

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function toEvent(row: EventRow): QuartzwallEvent {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    verdict: row.verdict,
    risk: Number(row.risk),
    reason: row.reason,
    toolName: row.tool_name,
    signals: parseJson<QuartzwallSignal[]>(row.signals_json, []),
    metadata: parseJson<Record<string, unknown>>(row.metadata_json, {}),
    createdAt: Number(row.created_at),
  };
}

export async function logQuartzwallEvent(event: {
  userId: string;
  type: QuartzwallEventType;
  verdict: QuartzwallVerdict;
  risk: number;
  reason: string;
  toolName?: string | null;
  signals?: QuartzwallSignal[];
  metadata?: Record<string, unknown>;
}) {
  const id = uuid();
  const createdAt = Math.floor(Date.now() / 1000);

  try {
    const db = await getDb();
    await db.execute({
      sql: `INSERT INTO quartzwall_events
        (id, user_id, type, verdict, risk, reason, tool_name, signals_json, metadata_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        event.userId,
        event.type,
        event.verdict,
        event.risk,
        event.reason,
        event.toolName || null,
        JSON.stringify(event.signals || []),
        JSON.stringify(event.metadata || {}),
        createdAt,
      ],
    });
  } catch (err) {
    logger.warn({ err, type: event.type, verdict: event.verdict }, "QUARTZWALL event log failed");
  }
}

export async function listQuartzwallEvents(userId: string, limit = 50) {
  const db = await getDb();
  const result = await db.execute({
    sql: `SELECT * FROM quartzwall_events
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?`,
    args: [userId, Math.max(1, Math.min(limit, 100))],
  });

  return mapRows<EventRow>(result).map(toEvent);
}

export async function getQuartzwallStats(userId: string): Promise<QuartzwallStats> {
  const db = await getDb();
  const [summary, byType] = await Promise.all([
    db.execute({
      sql: `SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN verdict = 'BLOCKED' THEN 1 ELSE 0 END) AS blocked,
          SUM(CASE WHEN verdict = 'SUSPICIOUS' THEN 1 ELSE 0 END) AS suspicious,
          SUM(CASE WHEN verdict = 'SAFE' THEN 1 ELSE 0 END) AS safe,
          AVG(risk) AS averageRisk,
          SUM(CASE WHEN created_at >= unixepoch() - 86400 THEN 1 ELSE 0 END) AS last24h
        FROM quartzwall_events
        WHERE user_id = ?`,
      args: [userId],
    }),
    db.execute({
      sql: `SELECT type, COUNT(*) AS count
        FROM quartzwall_events
        WHERE user_id = ?
        GROUP BY type`,
      args: [userId],
    }),
  ]);

  const summaryRow = mapRows<{
    total: number | null;
    blocked: number | null;
    suspicious: number | null;
    safe: number | null;
    averageRisk: number | null;
    last24h: number | null;
  }>(summary)[0];

  const byTypeRows = mapRows<{ type: QuartzwallEventType; count: number }>(byType);
  const counts: QuartzwallStats["byType"] = {
    INPUT_SCAN: 0,
    TOOL_CALL_POLICY: 0,
    TOOL_RESULT_SCAN: 0,
  };

  for (const row of byTypeRows) {
    counts[row.type] = Number(row.count || 0);
  }

  return {
    total: Number(summaryRow?.total || 0),
    blocked: Number(summaryRow?.blocked || 0),
    suspicious: Number(summaryRow?.suspicious || 0),
    safe: Number(summaryRow?.safe || 0),
    averageRisk: Math.round(Number(summaryRow?.averageRisk || 0)),
    last24h: Number(summaryRow?.last24h || 0),
    byType: counts,
  };
}
