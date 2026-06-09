// ── Input validation constants and helpers ──

export const LIMITS = {
  message: { max: 32_000 },
  username: { min: 2, max: 50 },
  email: { max: 254 },
  password: { min: 8, max: 128 },
};

export function validateMessage(content: string): string {
  if (!content || typeof content !== "string") {
    throw new Error("Message required");
  }
  const trimmed = content.trim();
  if (trimmed.length === 0) throw new Error("Message cannot be empty");
  if (trimmed.length > LIMITS.message.max) {
    throw new Error(
      `Message too long (max ${LIMITS.message.max.toLocaleString()} characters)`
    );
  }
  return trimmed;
}

export function validateEmail(email: string): string {
  if (!email || typeof email !== "string") {
    throw new Error("Email is required");
  }
  const trimmed = email.toLowerCase().trim();
  if (trimmed.length > LIMITS.email.max) {
    throw new Error("Email is too long");
  }
  // Basic email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    throw new Error("Invalid email format");
  }
  return trimmed;
}

export function validatePassword(password: string): string {
  if (!password || typeof password !== "string") {
    throw new Error("Password is required");
  }
  if (password.length < LIMITS.password.min) {
    throw new Error(
      `Password must be at least ${LIMITS.password.min} characters`
    );
  }
  if (password.length > LIMITS.password.max) {
    throw new Error("Password is too long");
  }
  return password;
}

export function validateUsername(name: string): string {
  if (!name || typeof name !== "string") {
    throw new Error("Name is required");
  }
  const trimmed = name.trim();
  if (trimmed.length < LIMITS.username.min) {
    throw new Error(
      `Name must be at least ${LIMITS.username.min} characters`
    );
  }
  if (trimmed.length > LIMITS.username.max) {
    throw new Error(`Name is too long (max ${LIMITS.username.max} characters)`);
  }
  return trimmed;
}
