import { NextResponse } from "next/server";
import crypto from "crypto";
import {
  getRefreshTokenCookie,
  hashRefreshToken,
  issueAccessToken,
  issueRefreshToken,
  setAuthCookies,
} from "../../lib/auth-utils";
import {
  findRefreshTokenByHash,
  deleteRefreshToken,
  insertRefreshToken,
  findUserById,
} from "../../lib/db";
import { logger } from "../../lib/logger";

const REFRESH_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

/**
 * POST /api/auth/refresh
 * Reads refresh_token cookie → validates against DB → issues new tokens.
 * Rotates: deletes old refresh token, issues new one (prevents replay).
 */
export async function POST(req: Request) {
  try {
    const refreshRaw = await getRefreshTokenCookie();
    if (!refreshRaw) {
      return NextResponse.json(
        { error: "No refresh token" },
        { status: 401 }
      );
    }

    const hash = hashRefreshToken(refreshRaw);
    const stored = findRefreshTokenByHash(hash);

    if (!stored || stored.expires_at < Math.floor(Date.now() / 1000)) {
      return NextResponse.json(
        { error: "Invalid or expired refresh token" },
        { status: 401 }
      );
    }

    // Verify user still exists
    const user = findUserById(stored.user_id);
    if (!user) {
      deleteRefreshToken(stored.id);
      return NextResponse.json(
        { error: "User not found" },
        { status: 401 }
      );
    }

    // Rotate: delete old, issue new
    deleteRefreshToken(stored.id);

    const { raw: newRaw, hash: newHash } = issueRefreshToken();
    insertRefreshToken({
      id: crypto.randomUUID(),
      user_id: stored.user_id,
      token_hash: newHash,
      expires_at: Math.floor(Date.now() / 1000) + REFRESH_TTL,
      user_agent: req.headers.get("user-agent") || undefined,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined,
    });

    const newAccess = issueAccessToken(user.id, user.email);
    await setAuthCookies(newAccess, newRaw);

    logger.info({ userId: user.id }, "Token refreshed");

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Refresh token error");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
