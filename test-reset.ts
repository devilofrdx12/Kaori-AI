import "dotenv/config";
import { findUserByEmail } from "./src/app/api/lib/db";
import { getDb } from "./src/app/api/lib/db";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";

async function test() {
  const db = await getDb();
  // 1. Get user
  const user = await db.execute({
    sql: "SELECT * FROM users WHERE email = 'sampleuser984@gmail.com'",
    args: []
  });
  
  if (!user.rows[0]) {
    console.log("User not found!");
    return;
  }
  const userId = user.rows[0].id as string;
  console.log("User ID:", userId);

  // 2. Insert Token directly
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = Math.floor(Date.now() / 1000) + 150;

  await db.execute({
    sql: "INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)",
    args: [uuidv4(), userId, tokenHash, expiresAt]
  });

  console.log("Token inserted. Trying to hit endpoint...");

  // 3. Hit the reset-password endpoint
  const res = await fetch("http://localhost:3000/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "9.9.9.9" },
    body: JSON.stringify({ token: rawToken, password: "newpassword123" })
  });

  const text = await res.text();
  console.log("Status:", res.status);
  console.log("Response:", text);
}

test().catch(console.error);
