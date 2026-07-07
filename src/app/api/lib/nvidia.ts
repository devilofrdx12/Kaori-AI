import { streamOpenAiCompatible } from "./openai-adapter";
import { KaoriMessage, KaoriTool } from "./core-types";

export async function streamNvidiaChatCompletion({
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
  const apiKey = model.includes("ultra") 
    ? process.env.NVIDIA_API_KEY_ULTRA?.trim() || process.env.NVIDIA_API_KEY?.trim()
    : process.env.NVIDIA_API_KEY_NANO?.trim() || process.env.NVIDIA_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(`API Key for ${model} is not configured.`);
  }

  // The Python snippet specifies extra_body for thinking capability
  const extraBody: Record<string, unknown> = {};
  
  if (model.includes("ultra") || model.includes("reasoning")) {
    // Enable reasoning budget per user Python snippet
    extraBody.chat_template_kwargs = { enable_thinking: true };
    extraBody.reasoning_budget = 16384;
    maxTokens = 16384;
  }

  return streamOpenAiCompatible({
    apiUrl: "https://integrate.api.nvidia.com/v1/chat/completions",
    apiKey,
    model,
    messages,
    system,
    tools,
    maxTokens,
    extraBody,
    signal,
  });
}
