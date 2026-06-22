import { NextResponse } from "next/server";
import { findUserByEmail, insertPasswordResetToken, deleteUserPasswordResetTokens } from "../../../api/lib/db";
import { checkPasswordResetRateLimit } from "../../../api/lib/rate-limit";
import { sendPasswordResetEmail } from "../../../../lib/emailService";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawEmail = body.email;

    if (!rawEmail || typeof rawEmail !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Normalise email to prevent rate-limit bypass via casing tricks
    const email = rawEmail.toLowerCase().trim();

    // Rate Limiting: 3 requests per IP/Email per hour
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    const bucket = `forgot_password:${ip}:${email}`;
    // 3600 seconds = 1 hour window
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
      return NextResponse.json({ message: "If an account with that email exists, we have sent a reset link." });
    }

    // Invalidate any old tokens for this user
    await deleteUserPasswordResetTokens(user.id);

    // Generate secure token
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = Math.floor(Date.now() / 1000) + 150; // 150 seconds (2.5 mins) from now

    // Insert into DB
    await insertPasswordResetToken({
      id: uuidv4(),
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    // Send email with dynamic base URL based on request headers (works on all domains)
    const protocol = req.headers.get("x-forwarded-proto") || "http";
    const host = req.headers.get("host") || "localhost:3000";
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`;
    const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;
    
    await sendPasswordResetEmail(user.email, resetUrl);

    return NextResponse.json({ message: "If an account with that email exists, we have sent a reset link." });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
