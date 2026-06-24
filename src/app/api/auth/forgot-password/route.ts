import { NextResponse } from "next/server";
import { findUserByEmail, insertPasswordResetToken, deleteUserPasswordResetTokens } from "../../../api/lib/db";
import { checkPasswordResetRateLimit } from "../../../api/lib/rate-limit";
import { validateEmail } from "../../../api/lib/validation";
import { sendPasswordResetEmail } from "../../../../lib/emailService";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";

const RESET_CODE_TTL_SECONDS = 10 * 60;
const PASSWORD_RESET_MESSAGE =
  "If an account with that email exists, we have sent a password reset code.";

function buildResetUrl(req: Request, email: string) {
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    const resetUrl = new URL("/reset-password", process.env.NEXT_PUBLIC_BASE_URL);
    resetUrl.searchParams.set("email", email);
    return resetUrl.toString();
  }

  const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || req.headers.get("host");
  const isLocalHost =
    host?.startsWith("localhost") ||
    host?.startsWith("127.0.0.1") ||
    host?.startsWith("[::1]");
  const protocol = forwardedProto || (isLocalHost ? "http" : "https");

  const origin = host ? `${protocol}://${host}` : new URL(req.url).origin;
  const resetUrl = new URL("/reset-password", origin);
  resetUrl.searchParams.set("email", email);
  return resetUrl.toString();
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawEmail = body.email;

    let email: string;
    try {
      email = validateEmail(rawEmail);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid email" },
        { status: 400 }
      );
    }

    // Rate limit per IP and email to reduce OTP spam without leaking accounts.
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    const bucket = `forgot_password:${ip}:${email}`;
    const { allowed, retryAfterSec } = await checkPasswordResetRateLimit(bucket);
    
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later.", retryAfterSec },
        { status: 429 }
      );
    }

    const user = await findUserByEmail(email);

    // SECURITY: Enumeration prevention with timing-attack mitigation.
    // When the user doesn't exist we add a random delay to make the
    // response time indistinguishable from the "user found" path.
    if (!user) {
      await new Promise((r) => setTimeout(r, 200 + Math.random() * 300));
      return NextResponse.json({ message: PASSWORD_RESET_MESSAGE });
    }

    // Invalidate any old codes for this user.
    await deleteUserPasswordResetTokens(user.id);

    const otp = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
    const tokenHash = crypto.createHash("sha256").update(`${email}:${otp}`).digest("hex");
    const expiresAt = Math.floor(Date.now() / 1000) + RESET_CODE_TTL_SECONDS;

    await insertPasswordResetToken({
      id: uuidv4(),
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    const resetUrl = buildResetUrl(req, email);
    
    await sendPasswordResetEmail(user.email, otp, resetUrl);

    return NextResponse.json({ message: PASSWORD_RESET_MESSAGE });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
