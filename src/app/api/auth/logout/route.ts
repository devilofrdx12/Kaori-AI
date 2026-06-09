import { NextResponse } from "next/server";
import {
  getSessionUser,
  clearAuthCookies,
  getRefreshTokenCookie,
  hashRefreshToken,
} from "../../lib/auth-utils";
import { deleteRefreshToken, findRefreshTokenByHash } from "../../lib/db";
import { logger } from "../../lib/logger";

export async function POST() {
  try {
    const user = await getSessionUser();

    // Delete refresh token from DB if it exists
    const refreshRaw = await getRefreshTokenCookie();
    if (refreshRaw) {
      const hash = hashRefreshToken(refreshRaw);
      const stored = findRefreshTokenByHash(hash);
      if (stored) {
        deleteRefreshToken(stored.id);
      }
    }

    // Clear cookies
    await clearAuthCookies();

    if (user) {
      logger.info({ userId: user.id }, "Logout");
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Logout error");
    return NextResponse.json({ ok: true }); // don't fail logout
  }
}
