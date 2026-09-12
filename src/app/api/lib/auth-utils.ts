import jwt from "jsonwebtoken";
import crypto from "crypto";
import { cookies } from "next/headers";
import { findUserById } from "./db";

function requireServerSecret(name: "JWT_SECRET" | "JWT_REFRESH_SECRET"): string {
  const value = process.env[name];

  if (!value || value.length < 32 || /change-me|your-random-secret/i.test(value)) {
    throw new Error(`${name} must be set to a strong random value of at least 32 characters`);
  }

  return value;
}

let _jwtSecret: string | undefined;
let _jwtRefreshSecret: string | undefined;

function getJwtSecret(): string {
  if (!_jwtSecret) _jwtSecret = requireServerSecret("JWT_SECRET");
  return _jwtSecret;
}

function getJwtRefreshSecret(): string {
  if (!_jwtRefreshSecret) _jwtRefreshSecret = requireServerSecret("JWT_REFRESH_SECRET");
  return _jwtRefreshSecret;
}

const ACCESS_COOKIE = "kaori_access";
const REFRESH_COOKIE = "kaori_refresh";

const ACCESS_TTL = 15 * 60; // 15 minutes
const REFRESH_TTL = 7 * 24 * 60 * 60; // 7 days

export type AuthPayload = {
  userId: string;
  email: string;
};

export function issueAccessToken(userId: string, email: string): string {
  return jwt.sign({ userId, email }, getJwtSecret(), { expiresIn: ACCESS_TTL });
}

export function verifyAccessToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as AuthPayload;
  } catch {
    return null;
  }
}

export function issueRefreshToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(48).toString("hex");
  const hash = hashRefreshToken(raw);
  return { raw, hash };
}

export function hashRefreshToken(raw: string): string {
  return crypto.createHmac("sha256", getJwtRefreshSecret()).update(raw).digest("hex");
}

export function hashPasswordResetCode(email: string, otp: string): string {
  return crypto
    .createHmac("sha256", getJwtRefreshSecret())
    .update(`${email.toLowerCase()}:${otp}`)
    .digest("hex");
}

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

export async function getSessionUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_COOKIE)?.value;
  if (!token) return null;

  const payload = verifyAccessToken(token);
  if (!payload) return null;

  const user = await findUserById(payload.userId);
  if (!user) return null;

  return { id: user.id, name: user.name, email: user.email, is_pro: user.is_pro === 1 };
}

export async function getRefreshTokenCookie(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(REFRESH_COOKIE)?.value;
}

export function requireAjax(req: Request): void {
  if (req.headers.get("X-Requested-With") !== "XMLHttpRequest") {
    throw new Response(JSON.stringify({ error: "CSRF check failed" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * Extract the real client IP from proxy headers using a rightmost-N trust model.
 *
 * TRUSTED_PROXY_COUNT (default 1) controls how many rightmost X-Forwarded-For
 * entries are considered trustworthy. With a single trusted reverse proxy
 * (Vercel Edge, Cloudflare, etc.), the client IP is the rightmost entry the
 * proxy appended — not the leftmost, which the client can forge freely.
 *
 * For N trusted proxies, the real client IP is at position `length - N`.
 */
export function getClientIp(req: Request): string {
  const trustedProxyCount = Math.max(
    1,
    parseInt(process.env.TRUSTED_PROXY_COUNT || "1", 10) || 1
  );

  const xffHeader = req.headers.get("x-forwarded-for");
  if (xffHeader) {
    const parts = xffHeader.split(",").map((s) => s.trim());
    // The client IP is at index `length - trustedProxyCount`.
    // With 1 trusted proxy, that's the last entry the proxy appended.
    const clientIndex = Math.max(0, parts.length - trustedProxyCount);
    const candidate = parts[clientIndex];

    if (
      candidate &&
      candidate.length <= 64 &&
      /^[a-f0-9:.]+$/i.test(candidate)
    ) {
      return candidate.toLowerCase();
    }
  }

  // Fallback to x-real-ip (typically set by nginx or Vercel).
  const realIp = req.headers.get("x-real-ip")?.trim() || "";
  if (realIp && realIp.length <= 64 && /^[a-f0-9:.]+$/i.test(realIp)) {
    return realIp.toLowerCase();
  }

  return "unknown";
}

export function getOAuthStateCookieName(provider: string): string {
  return `kaori_oauth_state_${provider}`;
}

function signOAuthState(provider: string, userId: string, state: string): string {
  return crypto
    .createHmac("sha256", getJwtRefreshSecret())
    .update(`${provider}:${userId}:${state}`)
    .digest("base64url");
}

export function createOAuthState(provider: string, userId: string) {
  const state = crypto.randomBytes(24).toString("base64url");
  return {
    state,
    cookieValue: `${userId}.${state}.${signOAuthState(provider, userId, state)}`,
  };
}

export function verifyOAuthState(
  provider: string,
  returnedState: string | null,
  cookieValue: string | undefined
): string | null {
  if (!returnedState || !cookieValue) return null;

  const [userId, state, signature] = cookieValue.split(".");
  if (!userId || !state || !signature || state !== returnedState) return null;

  const expected = signOAuthState(provider, userId, state);
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);

  if (
    expectedBuffer.length !== signatureBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
  ) {
    return null;
  }

  return userId;
}
