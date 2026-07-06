import { streamOpenAiCompatible } from "./openai-adapter";
import { KaoriMessage, KaoriTool } from "./core-types";


export async function streamOpenRouterChatCompletion({
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
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured.");
  }

  const extraHeaders: Record<string, string> = {};
  if (process.env.NEXT_PUBLIC_APP_URL) {
    extraHeaders["HTTP-Referer"] = process.env.NEXT_PUBLIC_APP_URL;
  }
  extraHeaders["X-Title"] = "Kaori AI";

  return streamOpenAiCompatible({
    apiUrl: "https://openrouter.ai/api/v1/chat/completions",
    apiKey,
    model,
    messages,
    system,
    tools,
    maxTokens,
    extraHeaders,
    signal,
  });
}
