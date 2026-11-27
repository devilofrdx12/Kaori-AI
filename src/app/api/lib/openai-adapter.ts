import { KaoriMessage, KaoriTool } from "./core-types";
import { logger } from "./logger";

async function verifyStreamStart(response: Response): Promise<ReadableStream<Uint8Array>> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Provider returned an empty response body");

  const chunks: Uint8Array[] = [];
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (!data || data === "[DONE]") continue;

      try {
        const event = JSON.parse(data);
        if (event?.error?.message) {
          throw new Error(`Provider stream error: ${event.error.message}`);
        }
      } catch (error) {
        if (error instanceof SyntaxError) continue;
        await reader.cancel().catch(() => {});
        throw error;
      }

      return new ReadableStream({
        async start(controller) {
          for (const chunk of chunks) controller.enqueue(chunk);
          try {
            while (true) {
              const next = await reader.read();
              if (next.done) break;
              controller.enqueue(next.value);
            }
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        },
      });
    }
  }

  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

function withIdleTimeout(
  stream: ReadableStream<Uint8Array>,
  timeoutMs = 120_000
): ReadableStream<Uint8Array> {
  const reader = stream.getReader();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let timeout: ReturnType<typeof setTimeout> | undefined;
      let timedOut = false;
      const armTimeout = () => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => {
          timedOut = true;
          void reader.cancel("Provider stream idle timeout").catch(() => {});
          controller.error(new Error("The AI provider stopped responding. Please retry."));
        }, timeoutMs);
      };

      try {
        armTimeout();
        while (true) {
          const next = await reader.read();
          if (timedOut) return;
          if (next.done) break;
          armTimeout();
          controller.enqueue(next.value);
        }
        if (timeout) clearTimeout(timeout);
        controller.close();
      } catch (error) {
        if (timeout) clearTimeout(timeout);
        if (timedOut) return;
        controller.error(error);
      }
    },
    async cancel(reason) {
      await reader.cancel(reason);
    },
  });
}

// Convert Kaori messages to OpenAI format
export function convertMessages(messages: KaoriMessage[]) {
  const openAiMessages: any[] = [];
  
  for (const msg of messages) {
    if (typeof msg.content === "string") {
      openAiMessages.push({ role: msg.role, content: msg.content });
    } else {
      const toolCalls: any[] = [];
      const contentArray: any[] = [];
      let hasImage = false;
      
      for (const block of msg.content) {
        if (block.type === "text") {
          contentArray.push({ type: "text", text: block.text });
        } else if (block.type === "image" && block.source) {
          hasImage = true;
          contentArray.push({
            type: "image_url",
            image_url: {
              url: `data:${block.source.media_type};base64,${block.source.data}`,
              detail: block.source.detail === "fast" ? "low" : block.source.detail === "high" ? "high" : "auto",
            }
          });
        } else if (block.type === "tool_use") {
          const tc: any = {
            id: block.id,
            type: "function",
            function: {
              name: block.name,
              arguments: JSON.stringify(block.input)
            }
          };
          if (block.extra_content) {
            tc.extra_content = block.extra_content;
          }
          toolCalls.push(tc);
        } else if (block.type === "tool_result") {
          openAiMessages.push({
            role: "tool",
            tool_call_id: block.tool_use_id,
            content: block.content
          });
        }
      }
      
      if (contentArray.length > 0 || toolCalls.length > 0) {
        const m: any = { role: msg.role };

        if (contentArray.length > 0) {
          if (hasImage) {
            m.content = contentArray;
          } else {
            m.content = contentArray.map(c => c.text).join("\n").trim();
          }
        }

        if (toolCalls.length > 0) {
          m.tool_calls = toolCalls;
          m.content = m.content || null;
        }
        openAiMessages.push(m);
      }
    }
  }
  return openAiMessages;
}

export async function streamOpenAiCompatible({
  apiUrl,
  apiKey,
  model,
  messages,
  system,
  tools,
  maxTokens = 4096,
  extraHeaders,
  extraBody,
  signal,
}: {
  apiUrl: string;
  apiKey: string;
  model: string;
  messages: KaoriMessage[];
  system?: string;
  tools?: KaoriTool[];
  maxTokens?: number;
  extraHeaders?: Record<string, string>;
  extraBody?: Record<string, unknown>;
  signal?: AbortSignal;
} = {} as any): Promise<Response> {
  const openAiMessages = convertMessages(messages);

  if (system) {
    openAiMessages.unshift({ role: "system", content: system });
  }

  const openAiTools = tools?.map(t => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema
    }
  }));

  const body: Record<string, unknown> = {
    model,
    messages: openAiMessages,
    stream: true,
    ...(extraBody || {}),
  };
  if (model.startsWith("gpt-5")) body.max_completion_tokens = maxTokens;
  else body.max_tokens = maxTokens;

  if (openAiTools && openAiTools.length > 0) {
    body.tools = openAiTools;
    body.tool_choice = "auto";
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apiKey}`,
    ...(extraHeaders || {}),
  };

  const resp = await fetch(apiUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal,
  });

  if (!resp.ok) {
    const errBody = await resp.text();
    let userMsg = `API error (${resp.status})`;
    
    if (resp.status === 429) {
      const retryAfter = resp.headers.get("retry-after");
      let extractedSeconds: number | null = null;
      
      if (retryAfter && !isNaN(parseInt(retryAfter, 10))) {
        extractedSeconds = parseInt(retryAfter, 10);
      }
      
      let apiMsg = "";
      try {
        const errJson = JSON.parse(errBody);
        apiMsg = (Array.isArray(errJson) ? errJson[0]?.error?.message : errJson.error?.message) || "";
      } catch {}

      // Fallback to searching the raw body if parsing failed or didn't find the message
      const textToSearch = apiMsg || errBody;
      const retryMatch = textToSearch.match(/try again in ([0-9.]+)s/i) || textToSearch.match(/retry in ([0-9.]+)s/i);
      
      if (retryMatch) {
        extractedSeconds = parseFloat(retryMatch[1]);
      }

      if (extractedSeconds !== null) {
        if (extractedSeconds < 60) {
          userMsg = `Model quota ended. Please try again after ${Math.ceil(extractedSeconds)} seconds.`;
        } else {
          const minutes = Math.ceil(extractedSeconds / 60);
          userMsg = `Model quota ended. Please try again after ${minutes} minute${minutes > 1 ? 's' : ''}.`;
        }
      } else {
        // If we can't find a specific time, at least show the helpful part of the API message
        userMsg = `Model quota ended. ${apiMsg ? apiMsg : "Please try again later."}`;
      }
    } else if (resp.status === 413) {
      logger.warn({ status: resp.status, body: errBody.slice(0, 300) }, "[openai-adapter] Provider rejected oversized request");
      userMsg = "This request is too large for the selected model. Start a new chat or send fewer/smaller attachments, then try again.";
    } else {
      // Log raw body server-side for debugging, but never expose to users.
      // Raw error bodies can contain internal API URLs, deployment IDs,
      // server stack traces, and token usage details.
      logger.error({ status: resp.status, body: errBody.slice(0, 500) }, "[openai-adapter] API error");
      userMsg = `API error (${resp.status}). Please try again or switch models.`;
    }
    
    throw new Error(userMsg);
  }

  const providerStream = await verifyStreamStart(resp);

  const transformStream = createOpenAiToAnthropicTransform();

  return new Response(withIdleTimeout(providerStream).pipeThrough(transformStream), {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store, no-cache, max-age=0",
      "Connection": "keep-alive",
    }
  });
}

export function createOpenAiToAnthropicTransform(): TransformStream<Uint8Array, Uint8Array> {
  let buffer = "";
  let hasToolCalls = false;
  let lastToolCallIndex = 0;
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  const processLine = (line: string, controller: TransformStreamDefaultController<Uint8Array>) => {
    if (!line.startsWith("data: ")) return;
    const data = line.slice(6).trim();
    if (!data) return;
    if (data === "[DONE]") {
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      return;
    }

    try {
      const event = JSON.parse(data);
      if (event?.error) {
        controller.error(new Error("The AI provider stopped responding. Please retry."));
        return;
      }
      const delta = event.choices?.[0]?.delta;
      const finishReason = event.choices?.[0]?.finish_reason;

      if (delta?.reasoning_content) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: "thinking_delta",
          text: delta.reasoning_content
        })}\n\n`));
      }

      if (delta?.content) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: "content_block_delta",
          delta: { type: "text_delta", text: delta.content }
        })}\n\n`));
      }

      if (delta?.tool_calls && delta.tool_calls.length > 0) {
        hasToolCalls = true;
        for (const tc of delta.tool_calls) {
          const tcIndex = typeof tc.index === "number" ? tc.index : lastToolCallIndex;
          lastToolCallIndex = tcIndex;

          if (tc.function?.name) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: "content_block_start",
              index: tcIndex,
              content_block: {
                type: "tool_use",
                id: tc.id || `call_${Date.now()}_${tcIndex}`,
                name: tc.function.name,
                ...(tc.extra_content ? { extra_content: tc.extra_content } : {})
              }
            })}\n\n`));
          }
          if (tc.extra_content && !tc.function?.name) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: "content_block_extra",
              index: tcIndex,
              extra_content: tc.extra_content
            })}\n\n`));
          }
          if (tc.function?.arguments) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: "content_block_delta",
              index: tcIndex,
              delta: { type: "input_json_delta", partial_json: tc.function.arguments }
            })}\n\n`));
          }
        }
      }

      if (finishReason) {
        const stopReason = (finishReason === "tool_calls" || (finishReason === "stop" && hasToolCalls))
          ? "tool_use"
          : finishReason === "stop"
          ? "end_turn"
          : finishReason;

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: "content_block_stop"
        })}\n\n`));

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: "message_delta",
          delta: { stop_reason: stopReason }
        })}\n\n`));
      }
    } catch {}
  };

  return new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        processLine(line, controller);
      }
    },
    flush(controller) {
      buffer += decoder.decode();
      if (buffer.trim()) {
        for (const line of buffer.split("\n")) {
          processLine(line, controller);
        }
      }
      buffer = "";
    },
  });
}
