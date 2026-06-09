import jwt from "jsonwebtoken";
import crypto from "crypto";
import { cookies } from "next/headers";
import { findUserById } from "./db";

// ── Secrets ──
const JWT_SECRET = process.env.JWT_SECRET || "claude-ai-secret-key-change-me-in-production";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "refresh-secret-change-me-in-production";

// ── Cookie names ──
const ACCESS_COOKIE = "kaori_access";
const REFRESH_COOKIE = "kaori_refresh";

// ── TTLs ──
const ACCESS_TTL = 15 * 60; // 15 minutes
const REFRESH_TTL = 7 * 24 * 60 * 60; // 7 days

// ── Types ──
export type AuthPayload = {
  userId: string;
  email: string;
};

// ══════════════════════════════════════════
// ACCESS TOKENS
// ══════════════════════════════════════════

export function issueAccessToken(userId: string, email: string): string {
  return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: ACCESS_TTL });
}

export function verifyAccessToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthPayload;
  } catch {
    return null;
  }
}

// ══════════════════════════════════════════
// REFRESH TOKENS
// ══════════════════════════════════════════

export function issueRefreshToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(48).toString("hex");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

export function hashRefreshToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

// ══════════════════════════════════════════
// COOKIE HELPERS
// ══════════════════════════════════════════

const COOKIE_BASE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
};

export async function setAuthCookies(accessToken: string, refreshTokenRaw: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACCESS_COOKIE, accessToken, {
    ...COOKIE_BASE,
    maxAge: ACCESS_TTL,
  });
  cookieStore.set(REFRESH_COOKIE, refreshTokenRaw, {
    ...COOKIE_BASE,
    maxAge: REFRESH_TTL,
  });
}

export async function setAccessCookie(accessToken: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACCESS_COOKIE, accessToken, {
    ...COOKIE_BASE,
    maxAge: ACCESS_TTL,
  });
}

export async function clearAuthCookies() {
  const cookieStore = await cookies();
  cookieStore.delete(ACCESS_COOKIE);
  cookieStore.delete(REFRESH_COOKIE);
}

// ══════════════════════════════════════════
// SESSION HELPER
// ══════════════════════════════════════════

export async function getSessionUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_COOKIE)?.value;
  if (!token) return null;

  const payload = verifyAccessToken(token);
  if (!payload) return null;

  const user = findUserById(payload.userId);
  if (!user) return null;

  return { id: user.id, name: user.name, email: user.email };
}

/**
 * Get the raw refresh token from cookie (for refresh endpoint).
 */
export async function getRefreshTokenCookie(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(REFRESH_COOKIE)?.value;
}

// ══════════════════════════════════════════
// CSRF PROTECTION
// ══════════════════════════════════════════

/**
 * Verify that the request came from JavaScript (not a form submission).
 * All API calls must include `X-Requested-With: XMLHttpRequest`.
 */
export function requireAjax(req: Request): void {
  if (req.headers.get("X-Requested-With") !== "XMLHttpRequest") {
    throw new Response(
      JSON.stringify({ error: "CSRF check failed" }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// ══════════════════════════════════════════
// IP EXTRACTION
// ══════════════════════════════════════════

export function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}
