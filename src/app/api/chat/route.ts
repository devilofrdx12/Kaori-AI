import { NextRequest } from "next/server";
import { getSessionUser } from "../lib/auth-utils";
import {
  findConversation,
  getConversationMessages,
  insertMessage,
  touchConversation,
} from "../lib/db";
import { streamChatCompletion, AnthropicMessage } from "../lib/anthropic";
import { TOOL_DEFINITIONS } from "@/lib/tools";
import { buildSystemPrompt } from "../lib/system-prompt";
import { encryptContent, decryptContent } from "../lib/crypto";
import { checkChatRateLimit } from "../lib/rate-limit";
import { validateMessage } from "../lib/validation";
import { detectInjection } from "../lib/injection-guard";
import { logger } from "../lib/logger";
import { v4 as uuid } from "uuid";

async function executeToolCall(
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<string> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  try {
    if (toolName === "web_search") {
      const resp = await fetch(`${baseUrl}/api/tools/web-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: toolInput.query }),
      });
      const data = await resp.json();
      if (data.error) return `Search error: ${data.error}`;

      if (!data.results?.length) return "No search results found.";

      return data.results
        .map(
          (r: { title: string; url: string; snippet: string }, i: number) =>
            `${i + 1}. **${r.title}**\n   ${r.snippet}\n   Source: ${r.url}`
        )
        .join("\n\n");
    }

    if (toolName === "web_fetch") {
      const resp = await fetch(`${baseUrl}/api/tools/web-fetch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: toolInput.url }),
      });
      const data = await resp.json();
      if (data.error) return `Fetch error: ${data.error}`;

      return `**${data.title}**\n\n${data.description ? `> ${data.description}\n\n` : ""}${data.content}`;
    }

    return `Unknown tool: ${toolName}`;
  } catch (err) {
    return `Tool execution error: ${err instanceof Error ? err.message : "Unknown error"}`;
  }
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { chatId, message, model, files } = await req.json();

    if (!chatId || !message) {
      return new Response(
        JSON.stringify({ error: "chatId and message are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // ── Input validation ──
    const validatedMessage = validateMessage(message);

    // ── Prompt injection check ──
    if (detectInjection(validatedMessage)) {
      logger.warn({ userId: user.id }, "Prompt injection attempt blocked");
      return new Response(
        JSON.stringify({ error: "Nice try 😏" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // ── Chat rate limiting ──
    const rateCheck = checkChatRateLimit(user.id);
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({
          error: `Rate limit reached. Try again in ${rateCheck.retryAfterSec}s.`,
        }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }

    // ── Ownership check ──
    const conv = findConversation(chatId);
    if (!conv || conv.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Chat not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // ── Save user message (encrypted) ──
    const userMsgId = uuid();
    insertMessage({
      id: userMsgId,
      conversation_id: chatId,
      role: "user",
      content: encryptContent(validatedMessage),
    });
    touchConversation(chatId);

    // ── Build message history from DB ──
    const dbMessages = getConversationMessages(chatId);
    const anthropicMessages: AnthropicMessage[] = dbMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: decryptContent(m.content),
    }));

    // Handle image files in last message
    if (files?.length) {
      const lastMsg = anthropicMessages[anthropicMessages.length - 1];
      const contentBlocks: any[] = [];

      for (const file of files) {
        if (file.data && file.type?.startsWith("image/")) {
          const base64Data = file.data.split(",")[1] || file.data;
          contentBlocks.push({
            type: "image",
            source: {
              type: "base64",
              media_type: file.type,
              data: base64Data,
            },
          });
        }
      }

      contentBlocks.push({ type: "text", text: validatedMessage });
      lastMsg.content = contentBlocks;
    }

    // ── Dynamic system prompt ──
    const systemPrompt = buildSystemPrompt(validatedMessage);

    // ── Create streaming response ──
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let currentMessages = [...anthropicMessages];
          let fullAssistantContent = "";
          let toolUseBlocks: any[] = [];
          let shouldContinue = true;

          while (shouldContinue) {
            shouldContinue = false;

            const response = await streamChatCompletion({
              model: model || "claude-sonnet-4-20250514",
              messages: currentMessages,
              system: systemPrompt,
              tools: TOOL_DEFINITIONS,
              maxTokens: 4096,
            });

            const reader = response.body!.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            let currentToolUse: any = null;
            let toolUseInputJson = "";
            let stopReason = "";

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() || "";

              for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                const data = line.slice(6).trim();
                if (data === "[DONE]") continue;

                try {
                  const event = JSON.parse(data);

                  if (event.type === "content_block_start") {
                    if (event.content_block?.type === "tool_use") {
                      currentToolUse = {
                        id: event.content_block.id,
                        name: event.content_block.name,
                        input: {},
                      };
                      toolUseInputJson = "";

                      controller.enqueue(
                        encoder.encode(
                          `data: ${JSON.stringify({
                            type: "tool_use_start",
                            tool: currentToolUse.name,
                          })}\n\n`
                        )
                      );
                    }
                  }

                  if (event.type === "content_block_delta") {
                    if (event.delta?.type === "text_delta") {
                      const text = event.delta.text;
                      fullAssistantContent += text;

                      controller.enqueue(
                        encoder.encode(
                          `data: ${JSON.stringify({
                            type: "text",
                            text,
                          })}\n\n`
                        )
                      );
                    }

                    if (event.delta?.type === "input_json_delta") {
                      toolUseInputJson += event.delta.partial_json;
                    }
                  }

                  if (event.type === "content_block_stop" && currentToolUse) {
                    try {
                      currentToolUse.input = JSON.parse(
                        toolUseInputJson || "{}"
                      );
                    } catch {
                      currentToolUse.input = {};
                    }
                    toolUseBlocks.push(currentToolUse);
                    currentToolUse = null;
                    toolUseInputJson = "";
                  }

                  if (event.type === "message_delta") {
                    stopReason = event.delta?.stop_reason || "";
                  }
                } catch {
                  // Skip unparseable events
                }
              }
            }

            // If Kaori wants to use tools, execute them and continue
            if (stopReason === "tool_use" && toolUseBlocks.length > 0) {
              const assistantContent: any[] = [];
              if (fullAssistantContent) {
                assistantContent.push({
                  type: "text",
                  text: fullAssistantContent,
                });
              }
              for (const tool of toolUseBlocks) {
                assistantContent.push({
                  type: "tool_use",
                  id: tool.id,
                  name: tool.name,
                  input: tool.input,
                });
              }
              currentMessages.push({
                role: "assistant",
                content: assistantContent,
              });

              // Execute tools and add results
              const toolResults: any[] = [];
              for (const tool of toolUseBlocks) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "tool_executing",
                      tool: tool.name,
                      input: tool.input,
                    })}\n\n`
                  )
                );

                logger.info(
                  { userId: user.id, tool: tool.name },
                  "Tool call"
                );

                const result = await executeToolCall(tool.name, tool.input);

                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "tool_result",
                      tool: tool.name,
                      result:
                        result.length > 200
                          ? result.slice(0, 200) + "..."
                          : result,
                    })}\n\n`
                  )
                );

                toolResults.push({
                  type: "tool_result",
                  tool_use_id: tool.id,
                  content: result,
                });
              }

              currentMessages.push({ role: "user", content: toolResults });

              // Reset for next iteration
              fullAssistantContent = "";
              toolUseBlocks = [];
              shouldContinue = true;
            }
          }

          // ── Save assistant message (encrypted) ──
          insertMessage({
            id: uuid(),
            conversation_id: chatId,
            role: "assistant",
            content: encryptContent(fullAssistantContent),
          });
          touchConversation(chatId);

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
          );
          controller.close();
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Stream error";
          logger.error({ err, userId: user.id }, "Chat stream error");
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", error: message })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    if (err instanceof Response) return err;
    const message = err instanceof Error ? err.message : "Internal error";
    logger.error({ err }, "Chat route error");
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
