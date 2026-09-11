import { NextRequest, NextResponse } from "next/server";
import { findUserByEmail, findPasswordResetTokenByHash, deletePasswordResetToken, updateUserPassword, deleteUserRefreshTokens } from "../../../api/lib/db";
import { checkPasswordResetRateLimit } from "../../../api/lib/rate-limit";
import { validateEmail, validatePassword } from "../../../api/lib/validation";
import { getClientIp, hashPasswordResetCode, requireAjax } from "../../../api/lib/auth-utils";
import { readJsonBodyWithLimit, RequestBodyError } from "../../../api/lib/request-body";
import { logger } from "../../../api/lib/logger";
import bcrypt from "bcryptjs";

const INVALID_CODE_MESSAGE = "Invalid or expired reset code";

export async function POST(req: NextRequest) {
  try {
    requireAjax(req);

    const body = await readJsonBodyWithLimit(req, 16 * 1024);
    const rawEmail = typeof body.email === "string" ? body.email : "";
    const rawOtp = body.otp;
    const rawPassword = typeof body.password === "string" ? body.password : "";

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

    const tokenHash = hashPasswordResetCode(email, otp);
    const tokenRecord = user ? await findPasswordResetTokenByHash(tokenHash) : null;

    if (!user || !tokenRecord || tokenRecord.user_id !== user.id) {
      return NextResponse.json({ error: INVALID_CODE_MESSAGE }, { status: 400 });
    }

    const now = Math.floor(Date.now() / 1000);
    if (tokenRecord.expires_at < now) {
      await deletePasswordResetToken(tokenRecord.id);
      return NextResponse.json({ error: INVALID_CODE_MESSAGE }, { status: 400 });
    }

    const newPasswordHash = await bcrypt.hash(password, 12);

    await updateUserPassword(tokenRecord.user_id, newPasswordHash);

    await deletePasswordResetToken(tokenRecord.id);

    // SECURITY: Invalidate all existing sessions so the user
    // must log in again with the new password everywhere.
    await deleteUserRefreshTokens(tokenRecord.user_id);

    return NextResponse.json({ message: "Password has been successfully reset" });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof RequestBodyError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error({ err: error }, "Reset password error");
    return NextResponse.json({ error: "Unable to reset the password right now. Please try again." }, { status: 500 });
  }
}
