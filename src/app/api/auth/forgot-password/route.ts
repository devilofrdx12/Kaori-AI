import { NextRequest, NextResponse } from "next/server";
import { findUserByEmail, insertPasswordResetToken, deleteUserPasswordResetTokens } from "../../../api/lib/db";
import { checkPasswordResetRateLimit } from "../../../api/lib/rate-limit";
import { validateEmail } from "../../../api/lib/validation";
import { getClientIp, hashPasswordResetCode, requireAjax } from "../../../api/lib/auth-utils";
import { buildTrustedAppUrl } from "../../../api/lib/app-origin";
import { sendPasswordResetEmail } from "../../../../lib/emailService";
import { readJsonBodyWithLimit, RequestBodyError } from "../../../api/lib/request-body";
import { logger } from "../../../api/lib/logger";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";

const RESET_CODE_TTL_SECONDS = 10 * 60;
const PASSWORD_RESET_MESSAGE =
  "If an account with that email exists, we have sent a password reset code.";

function buildResetUrl(req: Request, email: string) {
  const resetUrl = buildTrustedAppUrl("/reset-password", req);
  resetUrl.searchParams.set("email", email);
  return resetUrl.toString();
}

export async function POST(req: NextRequest) {
  try {
    requireAjax(req);

    const body = await readJsonBodyWithLimit(req, 16 * 1024);
    const rawEmail = typeof body.email === "string" ? body.email : "";

    let email: string;
    try {
      email = validateEmail(rawEmail);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid email" },
        { status: 400 }
      );
    }

    // Keep independent IP and account buckets: either dimension being abused is
    // enough to stop password-reset email spam.
    const ip = getClientIp(req);
    const [ipRate, emailRate] = await Promise.all([
      checkPasswordResetRateLimit(`forgot_password:ip:${ip}`),
      checkPasswordResetRateLimit(`forgot_password:email:${email}`),
    ]);
    
    if (!ipRate.allowed || !emailRate.allowed) {
      return NextResponse.json(
        {
          error: "Too many requests. Please try again later.",
          retryAfterSec: Math.max(ipRate.retryAfterSec, emailRate.retryAfterSec),
        },
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
    const tokenHash = hashPasswordResetCode(email, otp);
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
    if (error instanceof Response) return error;
    if (error instanceof RequestBodyError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error({ err: error }, "Forgot password error");
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
