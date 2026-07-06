import { NextRequest } from "next/server";
import { getSessionUser, requireAjax } from "../lib/auth-utils";
import {
  findConversation,
  getConversationMessages,
  deleteMessagesFrom,
  insertMessage,
  touchConversation,
  createDocument,
} from "../lib/db";
import {
  KaoriContentBlock,
  KaoriMessage,
} from "../lib/core-types";
import { streamGroqChatCompletion } from "../lib/groq";
import { streamGeminiChatCompletion } from "../lib/gemini";
import { streamOpenRouterChatCompletion } from "../lib/openrouter";
import { TOOL_DEFINITIONS } from "@/lib/tools";
import { buildSystemPrompt } from "../lib/system-prompt";
import { encryptContent, decryptContent } from "../lib/crypto";
import { checkChatRateLimit } from "../lib/rate-limit";
import { validateMessage, validateModel, validateUploadFiles } from "../lib/validation";
import { detectInjection } from "../lib/injection-guard";
import { logger } from "../lib/logger";
import { v4 as uuid } from "uuid";

type ToolUseBlock = {
  id: string;
  name: string;
  input: Record<string, unknown>;
};

type StreamEvent = {
  type?: string;
  content_block?: {
    id?: string;
    name?: string;
    type?: string;
  };
  delta?: {
    partial_json?: string;
    stop_reason?: string;
    text?: string;
    type?: string;
  };
};

async function executeToolCall(
  toolName: string,
  toolInput: Record<string, unknown>,
  userId?: string,
  lastPdfBase64?: string
): Promise<string> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  try {
    if (toolName === "web_search") {
      const resp = await fetch(`${baseUrl}/api/tools/web-search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
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
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({ url: toolInput.url }),
      });
      const data = await resp.json();
      if (data.error) return `Fetch error: ${data.error}`;

      return `**${data.title}**\n\n${data.description ? `> ${data.description}\n\n` : ""}${data.content}`;
    }
    if (toolName === "open_application") {
      return `Successfully sent command to client device to open ${toolInput.appName} at ${toolInput.uriScheme}. The user's device is now handling the request.`;
    }
    
    if (toolName === "create_document") {
      if (!userId) return "Error: User ID not found.";
      const docId = uuid();
      await createDocument({
        id: docId,
        user_id: userId,
        filename: String(toolInput.filename),
        format: String(toolInput.format),
        content: String(toolInput.content),
      });
      return `Document created successfully! Download it here: [${toolInput.filename}](${baseUrl}/api/download/${docId})`;
    }

    if (toolName === "analyze_pdf_visuals") {
      if (!lastPdfBase64) return "Error: No PDF was found in the recent upload context.";
      const apiKey = process.env.GOOGLE_GENERATIVE_AI_KEY;
      if (!apiKey) return "Error: Google API key not configured.";

      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: `Please analyze the visuals (images, graphs, charts, tables) in this PDF to answer the following query: ${toolInput.query}` },
              { inline_data: { mime_type: "application/pdf", data: lastPdfBase64 } }
            ]
          }]
        })
      });
      const data = await resp.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated from vision model.";
    }

    if (toolName === "play_spotify") {
      const queryLower = String(toolInput.songName).toLowerCase();
      if (queryLower.includes("liked songs")) {
        return `Found Spotify playlist: spotify:collection:tracks`;
      }

      const query = `site:open.spotify.com ${toolInput.songName}`;
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const resp = await fetch(searchUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
      });
      const html = await resp.text();
      const resultRegex = /<a rel="nofollow" class="result__a" href="([^"]*)"[^>]*>(.*?)<\/a>/g;
      
      let match;
      while ((match = resultRegex.exec(html)) !== null) {
        const url = decodeURIComponent(match[1].replace(/\/\/duckduckgo\.com\/l\/\?uddg=/, "").split("&")[0]);
        const spotifyMatch = url.match(/open\.spotify\.com\/(track|playlist|album|artist)\/([a-zA-Z0-9]+)/);
        if (spotifyMatch) {
          const type = spotifyMatch[1];
          const id = spotifyMatch[2];
          return `Found Spotify ${type}: spotify:${type}:${id}`;
        }
      }
      return "Could not find that on Spotify.";
    }

    if (toolName === "open_youtube") {
      const query = String(toolInput.videoName || "").trim();
      if (!query) {
        return `Found YouTube: https://www.youtube.com`;
      }

      const duckQuery = `site:youtube.com/watch ${query}`;
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(duckQuery)}`;
      const resp = await fetch(searchUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
      });
      const html = await resp.text();
      const resultRegex = /<a rel="nofollow" class="result__a" href="([^"]*)"[^>]*>(.*?)<\/a>/g;
      
      let match;
      while ((match = resultRegex.exec(html)) !== null) {
        const url = decodeURIComponent(match[1].replace(/\/\/duckduckgo\.com\/l\/\?uddg=/, "").split("&")[0]);
        const ytMatch = url.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/);
        if (ytMatch) {
          return `Found YouTube video: https://www.youtube.com/watch?v=${ytMatch[1]}`;
        }
      }
      return `Found YouTube search: https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    }

    return `Unknown tool: ${toolName}`;
  } catch (err) {
    return `Tool execution error: ${err instanceof Error ? err.message : "Unknown error"}`;
  }
}

export async function POST(req: NextRequest) {
  try {
    requireAjax(req);
  } catch (err) {
    if (err instanceof Response) return err;
  }

  const user = await getSessionUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { chatId, message, model, files, editMessageId, studyMode } = await req.json().catch(() => ({}));

    if (!chatId || (!message && !(files && files.length > 0))) {
      return new Response(
        JSON.stringify({ error: "chatId and message are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // ── Input validation ──
    const validatedFiles = validateUploadFiles(files);
    const validatedMessage = (!message || !message.trim()) && validatedFiles.length > 0 
      ? "" 
      : validateMessage(message);
    const validatedModel = validateModel(model);
    let lastPdfBase64: string | undefined;
    for (const f of validatedFiles) {
       if (f.type === "application/pdf") {
         lastPdfBase64 = f.data.split(",")[1] || f.data;
       }
    }

    // ── Prompt injection check ──
    if (detectInjection(validatedMessage)) {
      logger.warn({ userId: user.id }, "Prompt injection attempt blocked");
      return new Response(
        JSON.stringify({ error: "This request was blocked by the safety filter." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // ── Chat rate limiting ──
    const rateCheck = await checkChatRateLimit(user.id, user.is_pro);
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({
          error: `Rate limit reached. Try again in ${rateCheck.retryAfterSec}s.`,
        }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }

    // ── Ownership check ──
    const conv = await findConversation(chatId);
    if (!conv || conv.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Chat not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // ── Handle message edit (truncation) ──
    if (editMessageId) {
      await deleteMessagesFrom(chatId, editMessageId);
    }

    // ── Save user message (encrypted) ──
    const userMsgId = editMessageId || uuid();
    await insertMessage({
      id: userMsgId,
      conversation_id: chatId,
      role: "user",
      content: encryptContent(validatedMessage),
    });
    await touchConversation(chatId);

    // ── Build message history from DB ──
    const dbMessages = await getConversationMessages(chatId);
    const anthropicMessages: KaoriMessage[] = dbMessages.map((m) => {
      const decrypted = decryptContent(m.content);
      let content: any = decrypted;
      try {
        if (decrypted.trim().startsWith("[")) {
          content = JSON.parse(decrypted);
        }
      } catch {}
      return {
        role: m.role as "user" | "assistant",
        content,
      };
    });

    // Handle files in last message
    if (validatedFiles.length) {
      const lastMsg = anthropicMessages[anthropicMessages.length - 1];
      const contentBlocks: KaoriContentBlock[] = [];

      for (const file of validatedFiles) {
        const base64Data = file.data.split(",")[1] || file.data;
        
        if (file.type === "application/pdf") {
          try {
            const { extractPdfText } = await import("../lib/pdf-parser");
            const text = await extractPdfText(base64Data);
            contentBlocks.push({ type: "text", text });
          } catch (e: any) {
            logger.error({ err: e }, "PDF parse error");
            contentBlocks.push({ type: "text", text: `[Error extracting PDF text: ${e.message || e}]` });
          }
        } else {
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
    const systemPrompt = buildSystemPrompt(studyMode === true);

    // ── Create streaming response ──
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const currentMessages = [...anthropicMessages];
          let fullAssistantContent = "";
          let toolUseBlocks: ToolUseBlock[] = [];
          let shouldContinue = true;

          while (shouldContinue) {
            shouldContinue = false;

            const resolvedModel = validatedModel;
            let response;
            
            const attemptStream = async (model: string) => {
              if (model.startsWith("llama-") || model.startsWith("mixtral-")) {
                return await streamGroqChatCompletion({
                  model,
                  messages: currentMessages,
                  system: systemPrompt,
                  tools: TOOL_DEFINITIONS,
                  maxTokens: 8192,
                });
              } else if (model.startsWith("gemini-")) {
                return await streamGeminiChatCompletion({
                  model,
                  messages: currentMessages,
                  system: systemPrompt,
                  tools: TOOL_DEFINITIONS,
                  maxTokens: 8192,
                });
              } else if (model.includes("nemotron") || model.includes("gpt-oss") || model.includes("qwen") || model.includes("llama-3.2-11b-vision")) {
                return await streamOpenRouterChatCompletion({
                  model,
                  messages: currentMessages,
                  system: systemPrompt,
                  tools: TOOL_DEFINITIONS,
                  maxTokens: 8192,
                });
              } else {
                throw new Error(`Model ${model} is not supported`);
              }
            };

            try {
              response = await attemptStream(resolvedModel);
            } catch (err: any) {
              const errMsg = err.message || "";
              const isRateLimit = errMsg.includes("quota") || errMsg.includes("Rate limit") || errMsg.includes("429");
              const isOverloaded = errMsg.includes("503") || errMsg.includes("high demand") || errMsg.includes("UNAVAILABLE");

              if (isRateLimit || isOverloaded) {
                const fallbackModel = resolvedModel.startsWith("gemini-") ? "llama-3.3-70b-versatile" : "gemini-2.5-flash";
                const reason = isRateLimit ? "quota reached" : "model overloaded";
                logger.warn({ userId: user.id, fallbackModel, originalModel: resolvedModel, reason }, "API unavailable, triggering fallback");
                
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: "text", text: `\n*(Warning: Primary AI ${reason}. Automatically switching to backup AI provider...)*\n\n` })}\n\n`)
                );
                
                // Note: If the fallback also fails, it will just throw naturally and end the stream with the standard error handling.
                response = await attemptStream(fallbackModel);
              } else {
                throw err;
              }
            }

            const reader = response.body!.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            let currentToolUse: ToolUseBlock | null = null;
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
                  const event = JSON.parse(data) as StreamEvent;

                  if (event.type === "content_block_start") {
                    if (event.content_block?.type === "tool_use") {
                      currentToolUse = {
                        id: event.content_block.id || uuid(),
                        name: event.content_block.name || "unknown",
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
                      const text = event.delta.text || "";
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
                      toolUseInputJson += event.delta.partial_json || "";
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
              const assistantContent: KaoriContentBlock[] = [];
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
              await insertMessage({
                id: uuid(),
                conversation_id: chatId,
                role: "assistant",
                content: encryptContent(JSON.stringify(assistantContent)),
              });

              // Execute tools and add results
              const toolResults: KaoriContentBlock[] = [];
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

                const result = await executeToolCall(tool.name, tool.input, user.id, lastPdfBase64);

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
              await insertMessage({
                id: uuid(),
                conversation_id: chatId,
                role: "user",
                content: encryptContent(JSON.stringify(toolResults)),
              });

              // Reset for next iteration
              fullAssistantContent = "";
              toolUseBlocks = [];
              shouldContinue = true;
            }
          }

          // ── Save assistant message (encrypted) ──
          if (fullAssistantContent.trim()) {
            await insertMessage({
              id: uuid(),
              conversation_id: chatId,
              role: "assistant",
              content: encryptContent(fullAssistantContent),
            });
          }
          await touchConversation(chatId);

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
