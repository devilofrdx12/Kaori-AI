import { KaoriMessage, KaoriTool } from "./core-types";

// Convert Kaori messages to OpenAI format
function convertMessages(messages: KaoriMessage[]) {
  const openAiMessages: any[] = [];
  
  for (const msg of messages) {
    if (typeof msg.content === "string") {
      openAiMessages.push({ role: msg.role, content: msg.content });
    } else {
      let textContent = "";
      const toolCalls: any[] = [];
      
      for (const block of msg.content) {
        if (block.type === "text") {
          textContent += block.text + "\n";
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
      
      if (textContent || toolCalls.length > 0) {
        const m: any = { role: msg.role };
        if (textContent) m.content = textContent.trim();
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
  signal?: AbortSignal;
} = {} as any): Promise<Response> {
  const openAiMessages = convertMessages(messages);
  const extraHeadersObj = extraHeaders || {};
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
  };

  if (openAiTools && openAiTools.length > 0) {
    body.tools = openAiTools;
    body.tool_choice = "auto";
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apiKey}`,
    ...extraHeadersObj,
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
      userMsg += `: ${errBody}`;
    }
    
    throw new Error(userMsg);
  }

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

  return new Response(resp.body!.pipeThrough(transformStream), {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    }
  });
}
