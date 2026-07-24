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
  let apiKey = process.env.NVIDIA_API_KEY?.trim();
  if (model.includes("nano")) {
    apiKey = process.env.NVIDIA_API_KEY_NANO?.trim() || apiKey;
  } else if (model.includes("ultra")) {
    apiKey = process.env.NVIDIA_API_KEY_ULTRA?.trim() || apiKey;
  } else if (model.startsWith("deepseek-ai/")) {
    apiKey = process.env.NVIDIA_DEEPSEEK_API_KEY?.trim() || apiKey;
  }

  if (!apiKey) {
    throw new Error(`NVIDIA API Key for ${model} is not configured.`);
  }

  const extraBody: Record<string, unknown> = {};

  if (model.startsWith("deepseek-ai/")) {
    extraBody.reasoning_effort = model.endsWith("-pro") ? "max" : "high";
  } else if (model.includes("ultra") || model.includes("reasoning")) {
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
