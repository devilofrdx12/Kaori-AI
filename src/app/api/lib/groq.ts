import { KaoriMessage, KaoriTool } from "./core-types";
import { streamOpenAiCompatible } from "./openai-adapter";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

export function getGroqKey(): string {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY is not set in environment variables");
  return key;
}

export async function streamGroqChatCompletion({
  model,
  messages,
  system,
  tools,
  maxTokens = 4096,
  signal,
}: {
  model: string;
  messages: KaoriMessage[];
  system?: string;
  tools?: KaoriTool[];
  maxTokens?: number;
  signal?: AbortSignal;
}): Promise<Response> {
  const apiKey = getGroqKey();

  return streamOpenAiCompatible({
    apiUrl: GROQ_API_URL,
    apiKey,
    model,
    messages,
    system,
    tools,
    maxTokens,
    signal,
  });
}
