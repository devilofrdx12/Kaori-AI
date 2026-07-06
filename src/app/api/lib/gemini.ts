import { KaoriMessage, KaoriTool } from "./core-types";
import { streamOpenAiCompatible } from "./openai-adapter";

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

export function getGeminiKey(): string {
  const key = process.env.GOOGLE_GENERATIVE_AI_KEY;
  if (!key) throw new Error("GOOGLE_GENERATIVE_AI_KEY is not set in environment variables");
  return key;
}

export async function streamGeminiChatCompletion({
  model,
  messages,
  system,
  tools,
  maxTokens = 8192,
  signal,
}: {
  model: string;
  messages: KaoriMessage[];
  system?: string;
  tools?: KaoriTool[];
  maxTokens?: number;
  signal?: AbortSignal;
}): Promise<Response> {
  const apiKey = getGeminiKey();

  return streamOpenAiCompatible({
    apiUrl: GEMINI_API_URL,
    apiKey,
    model,
    messages,
    system,
    tools,
    maxTokens,
    signal,
  });
}
