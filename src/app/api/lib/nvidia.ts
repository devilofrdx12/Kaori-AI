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
  let requestSignal = signal;
  let startupTimer: ReturnType<typeof setTimeout> | undefined;
  let startupController: AbortController | undefined;
  let forwardAbort: (() => void) | undefined;

  if (model === "z-ai/glm-5.2") {
    // GLM 5.2 can spend a long time reasoning before its final answer.
    // Streaming plus a larger output budget prevents valid responses from
    // being cut off while keeping usage below NVIDIA's 32K hard limit.
    maxTokens = 16384;
    startupController = new AbortController();
    forwardAbort = () => startupController?.abort(signal?.reason);
    if (signal?.aborted) forwardAbort();
    else signal?.addEventListener("abort", forwardAbort, { once: true });
    startupTimer = setTimeout(
      () => startupController?.abort(new Error("GLM 5.2 startup timeout")),
      150_000
    );
    requestSignal = startupController.signal;
  } else if (model.startsWith("deepseek-ai/")) {
    extraBody.reasoning_effort = model.endsWith("-pro") ? "max" : "high";
  } else if (model.includes("ultra") || model.includes("reasoning")) {
    extraBody.chat_template_kwargs = { enable_thinking: true };
    extraBody.reasoning_budget = 16384;
    maxTokens = 16384;
  }
  try {
    return await streamOpenAiCompatible({
      apiUrl: "https://integrate.api.nvidia.com/v1/chat/completions",
      apiKey,
      model,
      messages,
      system,
      tools,
      maxTokens,
      extraBody,
      signal: requestSignal,
    });
  } catch (error) {
    if (model === "z-ai/glm-5.2" && startupController?.signal.aborted && !signal?.aborted) {
      throw new Error("GLM 5.2 is temporarily unavailable (startup timeout).");
    }
    throw error;
  } finally {
    if (startupTimer) clearTimeout(startupTimer);
  }
}
