import { NextResponse } from "next/server";
import { findUserByEmail, findPasswordResetTokenByHash, deletePasswordResetToken, updateUserPassword, deleteUserRefreshTokens } from "../../../api/lib/db";
import { checkPasswordResetRateLimit } from "../../../api/lib/rate-limit";
import { validateEmail, validatePassword } from "../../../api/lib/validation";
import { getClientIp, hashPasswordResetCode } from "../../../api/lib/auth-utils";
import bcrypt from "bcryptjs";

const INVALID_CODE_MESSAGE = "Invalid or expired reset code";

export async function POST(req: Request) {
  try {
    const { email: rawEmail, otp: rawOtp, password: rawPassword } = await req.json().catch(() => ({}));

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

    // OTP guessing must remain bounded even if an attacker rotates or spoofs
    // forwarding headers, so use an account-specific bucket as well as an IP one.
    const ip = getClientIp(req);
    const [ipRate, emailRate] = await Promise.all([
      checkPasswordResetRateLimit(`reset_password:ip:${ip}`),
      checkPasswordResetRateLimit(`reset_password:email:${email}`),
    ]);

    if (!ipRate.allowed || !emailRate.allowed) {
      return NextResponse.json(
        {
          error: "Too many attempts. Please try again later.",
          retryAfterSec: Math.max(ipRate.retryAfterSec, emailRate.retryAfterSec),
        },
        { status: 429 }
      );
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return NextResponse.json({ error: INVALID_CODE_MESSAGE }, { status: 400 });
    }

    const tokenHash = hashPasswordResetCode(email, otp);
    
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
    return NextResponse.json({ error: "Unable to reset the password right now. Please try again." }, { status: 500 });
  }
}
