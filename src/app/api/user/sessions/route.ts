import { NextRequest, NextResponse } from "next/server";
import { getDb, mapRows } from "../../lib/db";
import crypto from "crypto";

const AJAX_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
};

function getUserIdFromRequest(req: NextRequest): string | null {
  try {
    const jwt = require("jsonwebtoken");
    const token = req.cookies.get("token")?.value;
    if (!token) return null;
    const payload = jwt.verify(token, process.env.JWT_SECRET!);
    return typeof payload === "object" ? payload.userId : null;
  } catch {
    return null;
  }
}

type SessionRow = {
  id: string;
  token_hash: string;
  user_agent: string | null;
  ip: string | null;
  created_at: number;
  expires_at: number;
};

/**
 * GET /api/user/sessions — list active sessions for the current user
 */
export async function GET(req: NextRequest) {
  if (req.headers.get("X-Requested-With") !== "XMLHttpRequest") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const userId = getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  const now = Math.floor(Date.now() / 1000);

  const result = await db.execute({
    sql: `SELECT id, token_hash, user_agent, ip, created_at, expires_at
          FROM refresh_tokens
          WHERE user_id = ? AND expires_at > ?
          ORDER BY created_at DESC`,
    args: [userId, now],
  });

  // Hash the current refresh token cookie so we can identify which session is "this one"
  const currentRefreshToken = req.cookies.get("refresh_token")?.value;
  let currentTokenHash: string | null = null;
  if (currentRefreshToken) {
    currentTokenHash = crypto.createHash("sha256").update(currentRefreshToken).digest("hex");
  }

  const sessions = mapRows<SessionRow>(result).map((s) => {
    // Mask IPs for privacy: "192.168.1.42" -> "192.168.1.***"
    let maskedIp = "Unknown";
    if (s.ip) {
      const parts = s.ip.split(".");
      if (parts.length === 4) {
        maskedIp = `${parts[0]}.${parts[1]}.${parts[2]}.***`;
      } else {
        maskedIp = s.ip.substring(0, Math.min(s.ip.length, 12)) + "…";
      }
    }

    return {
      id: s.id,
      userAgent: s.user_agent || "Unknown device",
      ip: maskedIp,
      createdAt: s.created_at,
      expiresAt: s.expires_at,
      isCurrent: currentTokenHash ? s.token_hash === currentTokenHash : false,
    };
  });

  return NextResponse.json({ sessions });
}

/**
 * DELETE /api/user/sessions — revoke a specific session by id
 * Body: { sessionId: string }
 */
export async function DELETE(req: NextRequest) {
  if (req.headers.get("X-Requested-With") !== "XMLHttpRequest") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const userId = getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { sessionId } = body;

  if (!sessionId || typeof sessionId !== "string") {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  const db = await getDb();

  // Only allow revoking sessions that belong to this user
  await db.execute({
    sql: "DELETE FROM refresh_tokens WHERE id = ? AND user_id = ?",
    args: [sessionId, userId],
  });

  return NextResponse.json({ ok: true });
}
