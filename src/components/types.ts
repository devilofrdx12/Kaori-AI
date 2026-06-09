export type ProviderId = "claude";

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
    id: "claude-sonnet-4-20250514",
    label: "Kaori 4 Sonnet",
    provider: "claude",
    description: "Balanced speed & intelligence",
    badge: "Recommended",
    supportsVision: true,
    supportsThinking: true,
  },
  {
    id: "claude-opus-4-20250514",
    label: "Kaori 4 Opus",
    provider: "claude",
    description: "Most capable, best for complex tasks",
    badge: "Most Powerful",
    supportsVision: true,
    supportsThinking: true,
  },
  {
    id: "claude-3-5-haiku-20241022",
    label: "Kaori 3.5 Haiku",
    provider: "claude",
    description: "Fastest responses, great for quick tasks",
    badge: "Fastest",
    supportsVision: true,
    supportsThinking: false,
  },
];

export const DEFAULT_MODEL = "claude-sonnet-4-20250514";
