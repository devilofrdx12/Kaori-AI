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
import { readJsonBodyWithLimit, RequestBodyError } from "../../lib/request-body";

const REFRESH_TTL = 7 * 24 * 60 * 60; // 7 days

export async function POST(req: NextRequest) {
  try {
    // CSRF check
    requireAjax(req);

    // Parse and bound the body before touching external infrastructure so malformed
    // requests are classified consistently even during a database outage.
    const body = await readJsonBodyWithLimit(req, 16 * 1024);

    // Rate limit by IP
    const ip = getClientIp(req);
    const ipRate = await checkAuthRateLimit(`login:ip:${ip}`);
    if (!ipRate.allowed) {
      logger.warn({ ip }, "Auth rate limit hit (IP)");
      return NextResponse.json(
        {
          error: "Too many login attempts. Try again later.",
          retryAfterMs: ipRate.retryAfterMs,
        },
        { status: 429 }
      );
    }

    let email: string;
    let password: string;
    try {
      email = validateEmail(typeof body.email === "string" ? body.email : "");
      password = validatePassword(typeof body.password === "string" ? body.password : "");
    } catch {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Rate limit by Email (protect against botnets attacking one account)
    const emailRate = await checkAuthRateLimit(`login:email:${email}`);
    if (!emailRate.allowed) {
      logger.warn({ email }, "Auth rate limit hit (Email)");
      return NextResponse.json(
        {
          error: "Too many login attempts. Try again later.",
          retryAfterMs: emailRate.retryAfterMs,
        },
        { status: 429 }
      );
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      logger.info({ userId: user.id }, "Login failed: invalid password");
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Issue tokens
    const accessToken = issueAccessToken(user.id, user.email);
    const { raw: refreshRaw, hash: refreshHash } = issueRefreshToken();

    // Store refresh token
    await insertRefreshToken({
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
    if (err instanceof RequestBodyError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    logger.error({ err }, "Login error");
    return NextResponse.json(
      { error: "Unable to sign in right now." },
      { status: 500 }
    );
  }
}
