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

  // If gemini-3.5-flash or generic gemini-flash is specified, route to the fastest,
  // verified healthy Google Flash-Lite model (gemini-flash-lite-latest).
  const targetModel = (model === "gemini-3.5-flash" || model === "gemini-flash")
    ? "gemini-flash-lite-latest"
    : model;

  try {
    return await streamOpenAiCompatible({
      apiUrl: GEMINI_API_URL,
      apiKey,
      model: targetModel,
      messages,
      system,
      tools,
      maxTokens,
      signal,
    });
  } catch (err: any) {
    // If the targeted model encounters a 503 high demand spike, seamlessly fall back
    // to gemini-flash-lite-latest so the user's request always succeeds.
    if (targetModel !== "gemini-flash-lite-latest" && /503|unavailable|high demand|overload/i.test(err?.message || "")) {
      return await streamOpenAiCompatible({
        apiUrl: GEMINI_API_URL,
        apiKey,
        model: "gemini-flash-lite-latest",
        messages,
        system,
        tools,
        maxTokens,
        signal,
      });
    }
    throw err;
  }
}
