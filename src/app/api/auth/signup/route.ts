import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { v4 as uuid } from "uuid";
import { findUserByEmail, createUser, insertRefreshToken } from "../../lib/db";
import {
  issueAccessToken,
  issueRefreshToken,
  setAuthCookies,
  requireAjax,
  getClientIp,
} from "../../lib/auth-utils";
import { checkAuthRateLimit } from "../../lib/rate-limit";
import {
  validateUsername,
  validateEmail,
  validatePassword,
} from "../../lib/validation";
import { logger } from "../../lib/logger";

const REFRESH_TTL = 7 * 24 * 60 * 60; // 7 days

export async function POST(req: NextRequest) {
  try {
    // CSRF check
    requireAjax(req);

    // Rate limit by IP
    const ip = getClientIp(req);
    const rateCheck = await checkAuthRateLimit(ip);
    if (!rateCheck.allowed) {
      logger.warn({ ip }, "Auth rate limit hit on signup");
      return NextResponse.json(
        {
          error: "Too many attempts. Try again later.",
          retryAfterMs: rateCheck.retryAfterMs,
        },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));

    // Validate input
    const name = validateUsername(body.name);
    const email = validateEmail(body.email);
    const password = validatePassword(body.password);

    const existing = await findUserByEmail(email);
    if (existing) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await createUser({
      id: uuid(),
      name,
      email,
      password_hash: passwordHash,
    });

    // Issue tokens
    const accessToken = issueAccessToken(user.id, user.email);
    const { raw: refreshRaw, hash: refreshHash } = issueRefreshToken();

    await insertRefreshToken({
      id: crypto.randomUUID(),
      user_id: user.id,
      token_hash: refreshHash,
      expires_at: Math.floor(Date.now() / 1000) + REFRESH_TTL,
      user_agent: req.headers.get("user-agent") || undefined,
      ip,
    });

    await setAuthCookies(accessToken, refreshRaw);

    logger.info({ userId: user.id }, "Signup successful");

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
    });
  } catch (err) {
    if (err instanceof Response) return err;
    if (err instanceof Error && err.message) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    logger.error(
      { errorType: err instanceof Error ? err.name : typeof err },
      "Signup error"
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
