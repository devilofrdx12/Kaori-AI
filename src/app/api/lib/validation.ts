const ALLOWED_MODELS = new Set([
  "openai/gpt-oss-120b",
  "gemini-3.7-flash",
  "nvidia/nemotron-3-ultra-550b-a55b",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
  "nvidia/llama-3.1-nemotron-70b-instruct",
  "deepseek-ai/deepseek-v4-flash-0731",
  "z-ai/glm-5.2",
]);

const ALLOWED_UPLOAD_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"]);
const VISION_MODELS = new Set([
  "gemini-3.7-flash",
]);

export class InputValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputValidationError";
  }
}

export const LIMITS = {
  message: { max: 32_000 },
  username: { min: 2, max: 50 },
  email: { max: 254 },
  password: { min: 8, max: 128 },
  title: { max: 120 },
  project: { nameMax: 80, descriptionMax: 500, instructionsMax: 8_000 },
  memory: { contentMax: 2_000, tagMax: 32, maxTags: 10 },
  searchQuery: { max: 300 },
  files: {
    maxCount: 3,
    maxBase64Bytes: 5 * 1024 * 1024,
    maxTotalBase64Bytes: 8 * 1024 * 1024,
  },
};

function cleanSingleLine(value: unknown, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  return value.replace(/[\u0000-\u001F\u007F]/g, " ").trim().replace(/\s+/g, " ");
}

export function validateProjectInput(input: unknown): {
  name: string;
  description: string;
  instructions: string;
} {
  const candidate = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const name = cleanSingleLine(candidate.name);
  const description = cleanSingleLine(candidate.description);
  const instructions = typeof candidate.instructions === "string"
    ? candidate.instructions.replace(/\u0000/g, "").trim()
    : "";

  if (!name) throw new InputValidationError("Project name is required");
  if (name.length > LIMITS.project.nameMax) throw new InputValidationError("Project name is too long");
  if (description.length > LIMITS.project.descriptionMax) throw new InputValidationError("Project description is too long");
  if (instructions.length > LIMITS.project.instructionsMax) throw new InputValidationError("Project instructions are too long");

  return { name, description, instructions };
}

export function validateMemoryInput(input: unknown): { content: string; tags: string[] } {
  const candidate = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const content = typeof candidate.content === "string"
    ? candidate.content.replace(/\u0000/g, "").trim()
    : "";
  if (!content) throw new InputValidationError("Memory content is required");
  if (content.length > LIMITS.memory.contentMax) throw new InputValidationError("Memory is too long");

  const rawTags = Array.isArray(candidate.tags) ? candidate.tags : [];
  if (rawTags.length > LIMITS.memory.maxTags) throw new InputValidationError("Too many memory tags");
  const tags = [...new Set(rawTags.map((tag) => cleanSingleLine(tag).toLowerCase()).filter(Boolean))];
  if (tags.some((tag) => tag.length > LIMITS.memory.tagMax)) throw new InputValidationError("Memory tag is too long");

  return { content, tags };
}

export type ValidatedUploadFile = {
  name: string;
  type: string;
  data: string;
  detail: "fast" | "balanced" | "high";
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

  if (/[\u0000-\u001F\u007F<>"'\\]/.test(trimmed)) {
    throw new Error("Invalid email format");
  }

  const [localPart, domain] = trimmed.split("@");
  const emailRegex = /^[a-z0-9.!#$%&*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;
  if (
    !emailRegex.test(trimmed) ||
    !localPart ||
    !domain ||
    localPart.length > 64 ||
    localPart.startsWith(".") ||
    localPart.endsWith(".") ||
    localPart.includes("..")
  ) {
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
  if (/[\u0000-\u001F\u007F]/.test(trimmed)) {
    throw new Error("Name contains invalid characters");
  }
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

  const trimmed = title.replace(/[\u0000-\u001F\u007F]/g, " ").trim().replace(/\s+/g, " ");
  if (!trimmed) return "New chat";

  return trimmed.slice(0, LIMITS.title.max);
}

export function validateModel(model: unknown): string {
  if (typeof model !== "string" || !ALLOWED_MODELS.has(model)) {
    return "gemini-3.7-flash";
  }
  return model;
}

export function modelSupportsVision(model: string): boolean {
  return VISION_MODELS.has(model);
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

  let totalBytes = 0;
  return files.map((file) => {
    if (!file || typeof file !== "object") {
      throw new Error("Invalid file upload");
    }

    const candidate = file as Record<string, unknown>;
    const type = typeof candidate.type === "string" ? candidate.type.toLowerCase() : "";
    const data = typeof candidate.data === "string" ? candidate.data : "";
    const rawName = typeof candidate.name === "string" ? candidate.name : "image";
    const detail = candidate.detail === "fast" || candidate.detail === "high"
      ? candidate.detail
      : "balanced";
    if (/[\u0000-\u001F\u007F]/.test(rawName)) {
      throw new Error("Invalid file name");
    }
    const name = rawName.slice(0, 180) || "image";

    if (!ALLOWED_UPLOAD_TYPES.has(type)) {
      throw new Error("Unsupported file type");
    }

    const dataUrlMatch = /^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(data);
    let base64Data = data;
    if (data.includes(",")) {
      if (!dataUrlMatch || dataUrlMatch[1].toLowerCase() !== type) {
        throw new Error("Invalid file encoding");
      }
      base64Data = dataUrlMatch[2];
    }

    base64Data = base64Data.replace(/\s/g, "");
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64Data) || base64Data.length % 4 === 1) {
      throw new Error("Invalid file encoding");
    }

    const estimatedBytes = Math.floor((base64Data.length * 3) / 4);
    if (!base64Data || estimatedBytes > LIMITS.files.maxBase64Bytes) {
      throw new Error("Image is too large");
    }
    totalBytes += estimatedBytes;
    if (totalBytes > LIMITS.files.maxTotalBase64Bytes) {
      throw new Error("Combined upload is too large");
    }

    return { name, type, data, detail };
  });
}
