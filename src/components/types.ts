export type ProviderId = "groq" | "google" | "nvidia";

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
  input?: unknown;
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
    id: "gemini-2.7-pro",
    label: "Gemini 2.7 Pro",
    provider: "google",
    description: "Google's next-gen flagship 2.7 model",
    badge: "Ultra",
    supportsVision: true,
    supportsThinking: true,
  },
  {
    id: "gemini-2.7-flash",
    label: "Gemini 2.7 Flash",
    provider: "google",
    description: "Google's ultra-fast 2.7 next-gen model",
    badge: "Next-Gen",
    supportsVision: true,
    supportsThinking: false,
  },
  {
    id: "gemini-2.6-pro",
    label: "Gemini 2.6 Pro",
    provider: "google",
    description: "Google 2.6 high intelligence model",
    badge: "Pro",
    supportsVision: true,
    supportsThinking: true,
  },
  {
    id: "gemini-2.6-flash",
    label: "Gemini 2.6 Flash",
    provider: "google",
    description: "Google 2.6 fast & responsive AI",
    badge: "Flash",
    supportsVision: true,
    supportsThinking: false,
  },
  {
    id: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    provider: "google",
    description: "Google's capable 2.5 model for complex tasks",
    badge: "Capable",
    supportsVision: true,
    supportsThinking: true,
  },
  {
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    provider: "google",
    description: "Balanced speed & intelligence from Google",
    badge: "Vision",
    supportsVision: true,
    supportsThinking: false,
  },
  {
    id: "nvidia/nemotron-3-ultra-550b-a55b",
    label: "Nemotron 3 Ultra",
    provider: "nvidia",
    description: "Ultra-massive 550B chat model by Nvidia",
    badge: "Massive",
    supportsVision: false,
    supportsThinking: true,
  },
  {
    id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
    label: "Nemotron Nano Omni",
    provider: "nvidia",
    description: "Fast 30B reasoning model by Nvidia",
    badge: "Reasoning",
    supportsVision: false,
    supportsThinking: true,
  },
];

export const DEFAULT_MODEL = "llama-3.3-70b-versatile";

