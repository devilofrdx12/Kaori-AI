export type ProviderId = "groq" | "google";

export type UploadFile = {
  url: string;
  name: string;
  type: string;
  size?: number;
  data?: string;
};

export type MessageMode = "chat" | "image";

export type ToolUseBlock = {
  id: string;
  name: string;
  input: Record<string, unknown>;
};

export type ToolResultData = {
  toolName: string;
  result: unknown;
  isError?: boolean;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  image?: string;
  files?: UploadFile[];
  mode?: MessageMode;
  toolUse?: ToolUseBlock[];
  toolResults?: ToolResultData[];
  thinking?: string;
  timestamp?: string;
};

export type ModelOption = {
  id: string;
  label: string;
  provider: ProviderId;
  description: string;
  badge?: string;
  supportsVision: boolean;
  supportsThinking: boolean;
};

export const MODEL_OPTIONS: ModelOption[] = [
  {
    id: "llama-3.3-70b-versatile",
    label: "Groq LLaMA 3.3 70B",
    provider: "groq",
    description: "Lightning fast, open-weights model",
    badge: "Fastest",
    supportsVision: false,
    supportsThinking: false,
  },
  {
    id: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    provider: "google",
    description: "Google's most capable model, great for complex tasks",
    badge: "Most Powerful",
    supportsVision: true,
    supportsThinking: true,
  },
  {
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    provider: "google",
    description: "Balanced speed & intelligence from Google",
    badge: "Recommended",
    supportsVision: true,
    supportsThinking: false,
  },
];

export const DEFAULT_MODEL = "llama-3.3-70b-versatile";
