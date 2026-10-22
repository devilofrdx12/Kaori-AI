import { UploadFile, type ChatFeatureMode } from "@/components/types";
import type { ActionProposal } from "@/components/action-passport";

export type ChatThreadSummary = {
  id: string;
  title: string;
  isStarred?: boolean;
  projectId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ConnectionStatus = "online" | "waiting_for_network" | "reconnecting";

const AJAX_HEADERS: HeadersInit = {
  "X-Requested-With": "XMLHttpRequest",
};

const MAX_RECONNECT_WAIT_MS = 90_000;
const MAX_RECONNECT_ATTEMPTS = 3;

async function silentRefresh(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
      headers: AJAX_HEADERS,
    });
    return res.ok;
  } catch {
    return false;
  }
}

function isNetworkFailure(err: unknown): boolean {
  if (typeof window !== "undefined" && !navigator.onLine) return true;
  if (err instanceof TypeError) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /failed to fetch|networkerror|network request failed|load failed|network connection|internet|stream|aborted|socket|econnreset/i.test(
    msg
  );
}

async function checkServerReachable(signal?: AbortSignal): Promise<boolean> {
  if (typeof window !== "undefined" && !navigator.onLine) return false;
  try {
    const timeoutSignal = AbortSignal.timeout(4000);
    const combinedSignal = signal
      ? AbortSignal.any([signal, timeoutSignal])
      : timeoutSignal;
    const res = await fetch("/api/health", {
      method: "GET",
      cache: "no-store",
      signal: combinedSignal,
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Waits until the browser regains internet connectivity and `/api/health` responds.
 * Respects user cancellation (`signal`) and caps waiting at `timeoutMs` (default 90s).
 */
async function waitForInternet(
  signal?: AbortSignal,
  timeoutMs = MAX_RECONNECT_WAIT_MS
): Promise<boolean> {
  if (signal?.aborted) return false;

  const deadline = Date.now() + timeoutMs;

  return new Promise<boolean>((resolve) => {
    let settled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (pollTimer) clearTimeout(pollTimer);
      if (typeof window !== "undefined") {
        window.removeEventListener("online", handleOnline);
      }
      signal?.removeEventListener("abort", handleAbort);
    };

    const finish = (result: boolean) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    const handleAbort = () => finish(false);

    const probe = async () => {
      if (settled || signal?.aborted) return finish(false);
      if (Date.now() >= deadline) return finish(false);

      const reachable = await checkServerReachable(signal);
      if (reachable) {
        return finish(true);
      }

      if (!settled && Date.now() < deadline) {
        pollTimer = setTimeout(() => void probe(), 2500);
      } else {
        finish(false);
      }
    };

    const handleOnline = () => {
      if (pollTimer) clearTimeout(pollTimer);
      void probe();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("online", handleOnline);
    }
    signal?.addEventListener("abort", handleAbort, { once: true });

    // Start probing after a short initial backoff
    pollTimer = setTimeout(() => void probe(), 1200);
  });
}

async function fetchWithRetry(
  url: string,
  init: RequestInit
): Promise<Response> {
  const res = await fetch(url, { ...init, credentials: "include" });

  if (res.status === 401) {
    const refreshed = await silentRefresh();
    if (refreshed) {
      return fetch(url, { ...init, credentials: "include" });
    }
    throw new Error("UNAUTHORIZED");
  }

  return res;
}

async function jsonFetchWithRetry(url: string, init: RequestInit = {}) {
  const res = await fetchWithRetry(url, init);
  const text = await res.text();
  if (!res.ok) {
    let data: any = {};
    try {
      if (text.trim()) data = JSON.parse(text);
    } catch {
      // Not JSON
      throw new Error(`Request failed (${res.status}): ${text.slice(0, 100)}`);
    }
    throw new Error(data.error || data.message || `Request failed (${res.status})`);
  }
  
  try {
    return text.trim() ? JSON.parse(text) : null;
  } catch (err: any) {
    throw new Error(`Failed to parse API response (${res.status}): ${err.message}. Response excerpt: ${text.slice(0, 50)}...`);
  }
}

export async function listChats(): Promise<ChatThreadSummary[]> {
  return jsonFetchWithRetry("/api/chats", {
    headers: AJAX_HEADERS,
    cache: "no-store",
  });
}

export async function createChat(title?: string, projectId?: string | null): Promise<ChatThreadSummary> {
  return jsonFetchWithRetry("/api/chats", {
    method: "POST",
    headers: { ...AJAX_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({ title: title ?? "New chat", projectId: projectId || null }),
  });
}

export async function fetchChat(chatId: string) {
  return jsonFetchWithRetry(`/api/chats/${chatId}`, {
    headers: AJAX_HEADERS,
    cache: "no-store",
  });
}

export async function renameChat(chatId: string, title: string) {
  return jsonFetchWithRetry(`/api/chats/${chatId}`, {
    method: "PATCH",
    headers: { ...AJAX_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
}

export async function deleteChat(chatId: string) {
  return jsonFetchWithRetry(`/api/chats/${chatId}`, {
    method: "DELETE",
    headers: AJAX_HEADERS,
  });
}

export async function toggleStarChat(chatId: string, isStarred: boolean) {
  return jsonFetchWithRetry(`/api/chats/${chatId}`, {
    method: "PATCH",
    headers: { ...AJAX_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({ is_starred: isStarred }),
  });
}

export async function sendMessage({
  chatId,
  message,
  messageId,
  model,
  files,
  editMessageId,
  studyMode,
  featureMode,
  onText,
  onResetStream,
  onThinking,
  onToolStart,
  onToolExecuting,
  onActionProposal,
  onToolResult,
  onCouncilStatus,
  onConnectionStatus,
  onDone,
  onError,
  signal,
}: {
  chatId: string;
  message: string;
  messageId?: string;
  model: string;
  files?: UploadFile[];
  editMessageId?: string;
  studyMode?: boolean;
  featureMode?: ChatFeatureMode;
  onText: (text: string) => void;
  onResetStream?: () => void;
  onThinking?: (chunk: string) => void;
  onToolStart?: (tool: string) => void;
  onToolExecuting?: (tool: string) => void;
  onActionProposal?: (action: ActionProposal) => void;
  onToolResult?: (tool: string, result: string, input?: any) => void;
  onCouncilStatus?: (status: { phase: string; message?: string; model?: string; status?: string; models?: { model: string; label: string; status: string; role?: "prompt-refiner" | "answer-model" }[]; activities?: { id: string; model: string; label: string; kind: "prompt-refinement" | "draft" | "peer-review"; status: "working" | "complete" | "unavailable"; content?: string; summary?: string; truncated?: boolean }[]; activity?: { id: string; model: string; label: string; kind: "prompt-refinement" | "draft" | "peer-review"; status: "working" | "complete" | "unavailable"; content?: string; summary?: string; truncated?: boolean } }) => void;
  onConnectionStatus?: (status: ConnectionStatus) => void;
  onDone: () => void;
  onError: (error: string) => void;
  signal?: AbortSignal;
}) {
  // Blob/data preview URLs belong to the browser UI. Sending both `url` and
  // `data` duplicated every base64 image and could nearly double request size.
  const uploadPayload = files?.map(({ name, type, data, size, detail }) => ({
    name,
    type,
    data,
    size,
    detail,
  }));

  const targetUserMsgId = editMessageId || messageId;

  for (let attempt = 0; attempt <= MAX_RECONNECT_ATTEMPTS; attempt++) {
    if (signal?.aborted) return;

    let streamStarted = false;
    let receivedDoneEvent = false;
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    let pendingTextChunk = "";
    let pendingThinkingChunk = "";
    let lastFlushTime = Date.now();

    const flush = () => {
      if (pendingTextChunk) {
        onText(pendingTextChunk);
        pendingTextChunk = "";
      }
      if (pendingThinkingChunk) {
        onThinking?.(pendingThinkingChunk);
        pendingThinkingChunk = "";
      }
      lastFlushTime = Date.now();
    };

    const scheduleFlush = () => {
      const now = Date.now();
      if (now - lastFlushTime > 50) {
        if (flushTimer) {
          clearTimeout(flushTimer);
          flushTimer = null;
        }
        flush();
      } else if (!flushTimer) {
        flushTimer = setTimeout(() => {
          flushTimer = null;
          flush();
        }, 50 - (now - lastFlushTime));
      }
    };

    try {
      // If the browser is already offline before we even call fetch, wait for connection first
      if (typeof window !== "undefined" && !navigator.onLine) {
        onConnectionStatus?.("waiting_for_network");
        const reconnected = await waitForInternet(signal);
        if (signal?.aborted) return;
        if (!reconnected) {
          onConnectionStatus?.("online");
          onError("Connection lost. Please check your internet connection and retry.");
          return;
        }
        onConnectionStatus?.("reconnecting");
      }

      const requestBody = JSON.stringify({
        chatId,
        message,
        messageId,
        model,
        files: uploadPayload,
        editMessageId: attempt > 0 ? targetUserMsgId : editMessageId,
        studyMode,
        featureMode,
      });

      let res = await fetch("/api/chat", {
        method: "POST",
        credentials: "include",
        headers: {
          ...AJAX_HEADERS,
          "Content-Type": "application/json",
        },
        body: requestBody,
        signal,
      });

      if (res.status === 401) {
        const refreshed = await silentRefresh();
        if (refreshed) {
          res = await fetch("/api/chat", {
            method: "POST",
            credentials: "include",
            headers: {
              ...AJAX_HEADERS,
              "Content-Type": "application/json",
            },
            body: requestBody,
            signal,
          });
        } else {
          onConnectionStatus?.("online");
          onError("UNAUTHORIZED");
          return;
        }
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        onConnectionStatus?.("online");
        onError(data.error || `Request failed: ${res.status}`);
        return;
      }

      onConnectionStatus?.("online");
      streamStarted = true;

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (!data) continue;

          try {
            const event = JSON.parse(data);

            switch (event.type) {
              case "text":
                pendingTextChunk += event.text;
                scheduleFlush();
                break;
              case "thinking_delta":
                pendingThinkingChunk += event.text;
                scheduleFlush();
                break;
              case "tool_use_start":
                flush();
                onToolStart?.(event.tool);
                break;
              case "tool_executing":
                flush();
                onToolExecuting?.(event.tool);
                break;
              case "action_proposal":
                if (
                  event.action &&
                  typeof event.action.id === "string" &&
                  typeof event.action.appName === "string" &&
                  typeof event.action.uriScheme === "string" &&
                  typeof event.action.fallbackUrl === "string"
                ) {
                  flush();
                  onActionProposal?.(event.action as ActionProposal);
                }
                break;
              case "tool_result":
                flush();
                onToolResult?.(event.tool, event.result, event.input);
                break;
              case "council_status":
                flush();
                onCouncilStatus?.(event);
                break;
              case "done":
                receivedDoneEvent = true;
                if (flushTimer) clearTimeout(flushTimer);
                flush();
                onConnectionStatus?.("online");
                onDone();
                return;
              case "error":
                if (flushTimer) clearTimeout(flushTimer);
                flush();
                onConnectionStatus?.("online");
                onError(event.error);
                return;
            }
          } catch {
            // Skip malformed stream chunks.
          }
        }
      }

      if (flushTimer) clearTimeout(flushTimer);
      flush();

      // If the stream closed cleanly with `done`, we're finished.
      if (receivedDoneEvent) {
        onConnectionStatus?.("online");
        onDone();
        return;
      }

      // If the stream closed prematurely without a `done` or `error` event, treat it as an interrupted stream.
      throw new TypeError("Stream connection closed prematurely");
    } catch (err) {
      if (flushTimer) clearTimeout(flushTimer);
      if (signal?.aborted) {
        onConnectionStatus?.("online");
        return;
      }

      if (!isNetworkFailure(err) || attempt >= MAX_RECONNECT_ATTEMPTS) {
        onConnectionStatus?.("online");
        onError(err instanceof Error ? err.message : "Stream failed");
        return;
      }

      // Network dropped before or during streaming — pause and wait for internet to return!
      onConnectionStatus?.("waiting_for_network");
      const reconnected = await waitForInternet(signal);
      if (signal?.aborted) {
        onConnectionStatus?.("online");
        return;
      }
      if (!reconnected) {
        onConnectionStatus?.("online");
        onError("Connection lost while waiting for internet. Please retry.");
        return;
      }

      onConnectionStatus?.("reconnecting");

      // If the drop happened mid-stream, check if the server already completed and saved the reply in Turso
      if (streamStarted && targetUserMsgId) {
        try {
          const syncedChat = await fetchChat(chatId);
          const msgs = Array.isArray(syncedChat?.messages) ? syncedChat.messages : [];
          const userIdx = msgs.findIndex((m: any) => m.id === targetUserMsgId);
          if (userIdx !== -1 && userIdx + 1 < msgs.length) {
            const savedAssistantMsg = msgs[userIdx + 1];
            if (savedAssistantMsg?.role === "assistant" && savedAssistantMsg.content?.trim()) {
              onResetStream?.();
              if (Array.isArray(savedAssistantMsg.toolResults)) {
                for (const tr of savedAssistantMsg.toolResults) {
                  onToolResult?.(tr.toolName, tr.result);
                }
              }
              onText(savedAssistantMsg.content);
              onConnectionStatus?.("online");
              onDone();
              return;
            }
          }
        } catch {
          // If fetching chat state failed, fall through to re-running the stream
        }
      }

      // Otherwise, reset any partial stream output and retry the request now that we're back online
      onResetStream?.();
    }
  }
}

export function buildChatTitle(firstMessage: string): string {
  const clean = firstMessage.replace(/\n/g, " ").trim();
  return clean.length > 40 ? `${clean.slice(0, 40)}...` : clean;
}
