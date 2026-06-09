import crypto from "crypto";

// v8: Dedicated encryption key — NEVER reuse JWT_SECRET
// If JWT_SECRET leaks, encrypted data stays safe
function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ENCRYPTION_KEY is not set in environment variables");
  }
  return crypto.createHash("sha256").update(key).digest();
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * Returns: "iv:authTag:ciphertext" (all base64)
 */
export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString("base64"),
    tag.toString("base64"),
    enc.toString("base64"),
  ].join(":");
}

/**
 * Decrypt an AES-256-GCM encrypted string.
 * Input: "iv:authTag:ciphertext" (all base64)
 */
export function decrypt(stored: string): string {
  const [ivB64, tagB64, encB64] = stored.split(":");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getKey(),
    Buffer.from(ivB64, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return (
    decipher.update(Buffer.from(encB64, "base64")).toString("utf8") +
    decipher.final("utf8")
  );
}

/**
 * Encrypt message content for storage.
 */
export function encryptContent(content: string): string {
  return encrypt(content);
}

/**
 * Decrypt stored message content.
 * Falls back to plaintext if decryption fails (pre-encryption messages).
 */
export function decryptContent(stored: string): string {
  try {
    return decrypt(stored);
  } catch {
    // Fallback: plaintext from before encryption was enabled
    return stored;
  }
}
