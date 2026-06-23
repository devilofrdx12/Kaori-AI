import { NextResponse } from "next/server";
import { findUserByEmail, findPasswordResetTokenByHash, deletePasswordResetToken, updateUserPassword, deleteUserRefreshTokens } from "../../../api/lib/db";
import { checkPasswordResetRateLimit } from "../../../api/lib/rate-limit";
import { validateEmail, validatePassword } from "../../../api/lib/validation";
import crypto from "crypto";
import bcrypt from "bcryptjs";

const INVALID_CODE_MESSAGE = "Invalid or expired reset code";

export async function POST(req: Request) {
  try {
    const { email: rawEmail, otp: rawOtp, password: rawPassword } = await req.json();

    let email: string;
    let password: string;

    try {
      email = validateEmail(rawEmail);
      password = validatePassword(rawPassword);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid request" },
        { status: 400 }
      );
    }

    const otp = typeof rawOtp === "string" ? rawOtp.replace(/\D/g, "") : "";
    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json({ error: "Enter the 6-digit reset code" }, { status: 400 });
    }

    // Rate limit per IP and email to slow OTP guessing.
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    const bucket = `reset_password:${ip}:${email}`;
    const { allowed, retryAfterSec } = await checkPasswordResetRateLimit(bucket);

    if (!allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later.", retryAfterSec },
        { status: 429 }
      );
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return NextResponse.json({ error: INVALID_CODE_MESSAGE }, { status: 400 });
    }

    const tokenHash = crypto.createHash("sha256").update(`${email}:${otp}`).digest("hex");
    
    const tokenRecord = await findPasswordResetTokenByHash(tokenHash);

    if (!tokenRecord || tokenRecord.user_id !== user.id) {
      return NextResponse.json({ error: INVALID_CODE_MESSAGE }, { status: 400 });
    }

    const now = Math.floor(Date.now() / 1000);
    if (tokenRecord.expires_at < now) {
      await deletePasswordResetToken(tokenRecord.id);
      return NextResponse.json({ error: INVALID_CODE_MESSAGE }, { status: 400 });
    }

    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(password, saltRounds);

    await updateUserPassword(tokenRecord.user_id, newPasswordHash);

    await deletePasswordResetToken(tokenRecord.id);

    // SECURITY: Invalidate all existing sessions so the user
    // must log in again with the new password everywhere.
    await deleteUserRefreshTokens(tokenRecord.user_id);

    return NextResponse.json({ message: "Password has been successfully reset" });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "An unexpected error occurred" }, { status: 500 });
  }
}
