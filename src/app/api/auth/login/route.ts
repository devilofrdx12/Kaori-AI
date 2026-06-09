import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { findUserByEmail } from "../../lib/db";
import {
  issueAccessToken,
  issueRefreshToken,
  setAuthCookies,
  requireAjax,
  getClientIp,
} from "../../lib/auth-utils";
import { insertRefreshToken } from "../../lib/db";
import { checkAuthRateLimit } from "../../lib/rate-limit";
import { validateEmail, validatePassword } from "../../lib/validation";
import { logger } from "../../lib/logger";

const REFRESH_TTL = 7 * 24 * 60 * 60; // 7 days

export async function POST(req: NextRequest) {
  try {
    // CSRF check
    requireAjax(req);

    // Rate limit by IP
    const ip = getClientIp(req);
    const rateCheck = checkAuthRateLimit(ip);
    if (!rateCheck.allowed) {
      logger.warn({ ip }, "Auth rate limit hit");
      return NextResponse.json(
        {
          error: "Too many login attempts. Try again later.",
          retryAfterMs: rateCheck.retryAfterMs,
        },
        { status: 429 }
      );
    }

    const body = await req.json();

    // Validate input
    const email = validateEmail(body.email);
    const password = validatePassword(body.password);

    const user = findUserByEmail(email);
    if (!user) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      logger.info({ email }, "Login failed: invalid password");
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Issue tokens
    const accessToken = issueAccessToken(user.id, user.email);
    const { raw: refreshRaw, hash: refreshHash } = issueRefreshToken();

    // Store refresh token
    insertRefreshToken({
      id: crypto.randomUUID(),
      user_id: user.id,
      token_hash: refreshHash,
      expires_at: Math.floor(Date.now() / 1000) + REFRESH_TTL,
      user_agent: req.headers.get("user-agent") || undefined,
      ip,
    });

    // Set cookies
    await setAuthCookies(accessToken, refreshRaw);

    logger.info({ userId: user.id }, "Login successful");

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
    });
  } catch (err) {
    if (err instanceof Response) return err; // CSRF / validation throws
    if (err instanceof Error && err.message) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    logger.error({ err }, "Login error");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
