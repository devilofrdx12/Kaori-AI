import { NextResponse } from "next/server";
import { findPasswordResetTokenByHash, deletePasswordResetToken, updateUserPassword, deleteUserRefreshTokens } from "../../../api/lib/db";
import { checkPasswordResetRateLimit } from "../../../api/lib/rate-limit";
import crypto from "crypto";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const { token, password } = await req.json();

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    if (!password || typeof password !== "string" || password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters long" }, { status: 400 });
    }

    // Rate Limiting: prevent brute-force token guessing (5 attempts per 15 min per IP)
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    const bucket = `reset_password:${ip}`;
    const { allowed, retryAfterSec } = await checkPasswordResetRateLimit(bucket);

    if (!allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later.", retryAfterSec },
        { status: 429 }
      );
    }

    // Hash the token from the user to match what is in DB
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    
    // Find the token
    const tokenRecord = await findPasswordResetTokenByHash(tokenHash);

    if (!tokenRecord) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
    }

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (tokenRecord.expires_at < now) {
      await deletePasswordResetToken(tokenRecord.id); // clean up expired token
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
    }

    // Token is valid. Hash new password
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(password, saltRounds);

    // Update user password
    await updateUserPassword(tokenRecord.user_id, newPasswordHash);

    // Delete the used token
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
