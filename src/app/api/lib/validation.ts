const ALLOWED_MODELS = new Set([
  "llama-3.3-70b-versatile",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "claude-sonnet-4-20250514",
]);

const ALLOWED_UPLOAD_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"]);

export const LIMITS = {
  message: { max: 32_000 },
  username: { min: 2, max: 50 },
  email: { max: 254 },
  password: { min: 8, max: 128 },
  title: { max: 120 },
  searchQuery: { max: 300 },
  files: { maxCount: 3, maxBase64Bytes: 5 * 1024 * 1024 },
};

export type ValidatedUploadFile = {
  name: string;
  type: string;
  data: string;
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
    throw new Error(`Password must be at least ${LIMITS.password.min} characters`);
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
    throw new Error(`Name must be at least ${LIMITS.username.min} characters`);
  }
  if (trimmed.length > LIMITS.username.max) {
    throw new Error(`Name is too long (max ${LIMITS.username.max} characters)`);
  }
  return trimmed;
}

export function validateConversationTitle(title: unknown): string {
  if (typeof title !== "string") return "New chat";

  const trimmed = title.trim().replace(/\s+/g, " ");
  if (!trimmed) return "New chat";

  return trimmed.slice(0, LIMITS.title.max);
}

export function validateModel(model: unknown): string {
  if (typeof model !== "string" || !ALLOWED_MODELS.has(model)) {
    return "gemini-2.5-flash";
  }
  return model;
}

export function validateSearchQuery(query: unknown): string {
  if (typeof query !== "string") {
    throw new Error("Query is required");
  }

  const trimmed = query.trim();
  if (!trimmed) throw new Error("Query is required");
  if (trimmed.length > LIMITS.searchQuery.max) {
    throw new Error(`Query too long (max ${LIMITS.searchQuery.max} characters)`);
  }

  return trimmed;
}

export function validateUploadFiles(files: unknown): ValidatedUploadFile[] {
  if (!Array.isArray(files) || files.length === 0) return [];
  if (files.length > LIMITS.files.maxCount) {
    throw new Error(`Too many files (max ${LIMITS.files.maxCount})`);
  }

  return files.map((file) => {
    if (!file || typeof file !== "object") {
      throw new Error("Invalid file upload");
    }

    const candidate = file as Record<string, unknown>;
    const type = typeof candidate.type === "string" ? candidate.type : "";
    const data = typeof candidate.data === "string" ? candidate.data : "";
    const name = typeof candidate.name === "string" ? candidate.name.slice(0, 180) : "image";

    if (!ALLOWED_UPLOAD_TYPES.has(type)) {
      throw new Error("Unsupported file type");
    }

    const base64Data = data.split(",")[1] || data;
    const estimatedBytes = Math.floor((base64Data.length * 3) / 4);
    if (!base64Data || estimatedBytes > LIMITS.files.maxBase64Bytes) {
      throw new Error("Image is too large");
    }

    return { name, type, data };
  });
}
