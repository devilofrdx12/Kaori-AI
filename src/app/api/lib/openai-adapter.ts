import { KaoriMessage, KaoriTool } from "./core-types";

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

// Convert Kaori messages to OpenAI format
function convertMessages(messages: KaoriMessage[]) {
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
              url: `data:${block.source.media_type};base64,${block.source.data}`
            }
          });
        } else if (block.type === "tool_use") {
          toolCalls.push({
            id: block.id,
            type: "function",
            function: {
              name: block.name,
              arguments: JSON.stringify(block.input)
            }
          });
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

        if (toolCalls.length > 0) m.tool_calls = toolCalls;
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
    max_tokens: maxTokens,
    stream: true,
    ...(extraBody || {}),
  };

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
    } else {
      // Log raw body server-side for debugging, but never expose to users.
      // Raw error bodies can contain internal API URLs, deployment IDs,
      // server stack traces, and token usage details.
      console.error(`[openai-adapter] API error ${resp.status}:`, errBody.slice(0, 500));
      userMsg = `API error (${resp.status}). Please try again or switch models.`;
    }
    
    throw new Error(userMsg);
  }

  const providerStream = await verifyStreamStart(resp);

  // Return a TransformStream that converts OpenAI SSE to Anthropic SSE
  let buffer = "";
  const decoder = new TextDecoder();
  const transformStream = new TransformStream({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") {
           controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
           continue;
        }
        
        try {
          const event = JSON.parse(data);
          const delta = event.choices?.[0]?.delta;
          const finishReason = event.choices?.[0]?.finish_reason;
          
          if (delta?.reasoning_content) {
            // Emit as a special 'thinking' event — UI handles display
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({
              type: "thinking_delta",
              text: delta.reasoning_content
            })}\n\n`));
          }
          
          if (delta?.content) {
             controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({
               type: "content_block_delta",
               delta: { type: "text_delta", text: delta.content }
             })}\n\n`));
          }
          
          if (delta?.tool_calls) {
             for (const tc of delta.tool_calls) {
               if (tc.function?.name) {
                 controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({
                   type: "content_block_start",
                   content_block: { type: "tool_use", id: tc.id || "call_" + Date.now(), name: tc.function.name }
                 })}\n\n`));
               }
               if (tc.function?.arguments) {
                 controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({
                   type: "content_block_delta",
                   delta: { type: "input_json_delta", partial_json: tc.function.arguments }
                 })}\n\n`));
               }
             }
          }
          
          if (finishReason) {
             let stopReason = finishReason;
             if (finishReason === "tool_calls") stopReason = "tool_use";
             if (finishReason === "stop") stopReason = "end_turn";
             
             controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({
               type: "content_block_stop"
             })}\n\n`));
             
             controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({
               type: "message_delta",
               delta: { stop_reason: stopReason }
             })}\n\n`));
          }
        } catch {}
      }
    }
  });

  return new Response(providerStream.pipeThrough(transformStream), {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    }
  });
}
