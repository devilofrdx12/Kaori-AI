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

const JWT_SECRET = requireServerSecret("JWT_SECRET");
const JWT_REFRESH_SECRET = requireServerSecret("JWT_REFRESH_SECRET");

const ACCESS_COOKIE = "kaori_access";
const REFRESH_COOKIE = "kaori_refresh";

const ACCESS_TTL = 15 * 60; // 15 minutes
const REFRESH_TTL = 7 * 24 * 60 * 60; // 7 days

export type AuthPayload = {
  userId: string;
  email: string;
};

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

export function issueRefreshToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(48).toString("hex");
  const hash = hashRefreshToken(raw);
  return { raw, hash };
}

export function hashRefreshToken(raw: string): string {
  return crypto.createHmac("sha256", JWT_REFRESH_SECRET).update(raw).digest("hex");
}

export function hashPasswordResetCode(email: string, otp: string): string {
  return crypto
    .createHmac("sha256", JWT_REFRESH_SECRET)
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

export function getClientIp(req: Request): string {
  const candidate =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "";

  // Keep rate-limit keys bounded and log-safe even behind a malformed proxy.
  if (!candidate || candidate.length > 64 || !/^[a-f0-9:.]+$/i.test(candidate)) {
    return "unknown";
  }

  return candidate.toLowerCase();
}

export function getOAuthStateCookieName(provider: string): string {
  return `kaori_oauth_state_${provider}`;
}

function signOAuthState(provider: string, userId: string, state: string): string {
  return crypto
    .createHmac("sha256", JWT_REFRESH_SECRET)
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
