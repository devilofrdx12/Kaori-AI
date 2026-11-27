export type ProviderId = "groq" | "google" | "nvidia";

export type UploadFile = {
  url: string;
  name: string;
  type: string;
  size?: number;
  data?: string;
  detail?: ImageDetail;
};

export type ImageDetail = "fast" | "balanced" | "high";
export type ThinkingCap = "minimal" | "low" | "medium" | "high" | "xhigh";
export type ChatFeatureMode = "auto" | "web" | "deep" | "thinking" | "council";

export const THINKING_CAP_OPTIONS: {
  id: ThinkingCap;
  label: string;
  description: string;
}[] = [
  { id: "minimal", label: "Minimal", description: "Fastest responses with minimal thinking" },
  { id: "low", label: "Low", description: "Light reasoning for straightforward tasks" },
  { id: "medium", label: "Medium", description: "Balanced reasoning speed and depth" },
  { id: "high", label: "High", description: "Deep reasoning (Hydrogen default)" },
  { id: "xhigh", label: "XHigh", description: "Maximum thinking depth for hard problems" },
];

export const DEFAULT_THINKING_CAP: ThinkingCap = "high";

export function getThinkingCapSelectedTextClass(cap: ThinkingCap): string {
  if (cap === "xhigh") return "thinking-cap-xhigh-text font-semibold";
  if (cap === "high") return "text-primary font-semibold";
  return "text-on-surface";
}

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
  featureMode?: ChatFeatureMode;
  thinkingCap?: ThinkingCap;
  toolUse?: ToolUseBlock[];
  toolResults?: ToolResultData[];
  thinking?: string;
  timestamp?: string;
  stopped?: boolean;
  error?: boolean;
  retryable?: boolean;
};

export type ModelOption = {
  id: string;
  label: string;
  provider: ProviderId;
  description: string;
  badge?: string;
  supportsVision: boolean;
  supportsThinking: boolean;
  thinkingCaps?: ThinkingCap[];
  defaultThinkingCap?: ThinkingCap;
};

export const MODEL_OPTIONS: ModelOption[] = [
  {
    id: "openai/gpt-oss-120b",
    label: "Groq GPT-OSS 120B",
    provider: "groq",
    description: "Lightning fast, open-weights model",
    badge: "Fastest",
    supportsVision: false,
    supportsThinking: false,
  },
  {
    id: "gemini-4-hydrogen",
    label: "Gemini 4 Hydrogen",
    provider: "google",
    description: "Google's Gemini 4 workhorse with adjustable thinking cap & vision",
    badge: "Free · Gemini 4",
    supportsVision: true,
    supportsThinking: true,
    thinkingCaps: ["minimal", "low", "medium", "high", "xhigh"],
    defaultThinkingCap: "high",
  },
  {
    id: "gemini-flash-lite-latest",
    label: "Gemini Flash Lite (Latest)",
    provider: "google",
    description: "Google's fastest, high-uptime multimodal vision model",
    badge: "Fast & Stable",
    supportsVision: true,
    supportsThinking: false,
  },
  {
    id: "gemini-3.8-flash",
    label: "Gemini 3.8 Flash",
    provider: "google",
    description: "Google's newest reasoning Flash model with multimodal vision",
    badge: "Reasoning & Vision",
    supportsVision: true,
    supportsThinking: true,
  },
  {
    id: "gemini-3.5-flash",
    label: "Gemini 3.5 Flash",
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
    badge: "Omni Vision",
    supportsVision: true,
    supportsThinking: true,
  },
  {
    id: "nvidia/llama-3.1-nemotron-70b-instruct",
    label: "Nemotron 70B Instruct",
    provider: "nvidia",
    description: "Powerful 70B reasoning model from Nvidia",
    badge: "70B",
    supportsVision: false,
    supportsThinking: true,
  },

  {
    id: "deepseek-ai/deepseek-v4-flash-0731",
    label: "DeepSeek V4 Flash",
    provider: "nvidia",
    description: "DeepSeek V4 Flash on Nvidia NIM",
    badge: "Vision",
    supportsVision: true,
    supportsThinking: true,
  },
];

export const DEFAULT_MODEL = "openai/gpt-oss-120b";
