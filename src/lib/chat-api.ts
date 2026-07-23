import { UploadFile } from "@/components/types";
import type { ActionProposal } from "@/components/action-passport";

export type ChatThreadSummary = {
  id: string;
  title: string;
  isStarred?: boolean;
  projectId?: string | null;
  createdAt: string;
  updatedAt: string;
};

const AJAX_HEADERS: HeadersInit = {
  "X-Requested-With": "XMLHttpRequest",
};

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
  model,
  files,
  editMessageId,
  studyMode,
  onText,
  onThinking,
  onToolStart,
  onToolExecuting,
  onActionProposal,
  onToolResult,
  onDone,
  onError,
  signal,
}: {
  chatId: string;
  message: string;
  model: string;
  files?: UploadFile[];
  editMessageId?: string;
  studyMode?: boolean;
  onText: (text: string) => void;
  onThinking?: (chunk: string) => void;
  onToolStart?: (tool: string) => void;
  onToolExecuting?: (tool: string) => void;
  onActionProposal?: (action: ActionProposal) => void;
  onToolResult?: (tool: string, result: string, input?: any) => void;
  onDone: () => void;
  onError: (error: string) => void;
  signal?: AbortSignal;
}) {
  try {
    let res = await fetch("/api/chat", {
      method: "POST",
      credentials: "include",
      headers: {
        ...AJAX_HEADERS,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ chatId, message, model, files, editMessageId, studyMode }),
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
          body: JSON.stringify({ chatId, message, model, files, editMessageId, studyMode }),
          signal,
        });
      } else {
        onError("UNAUTHORIZED");
        return;
      }
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      onError(data.error || `Request failed: ${res.status}`);
      return;
    }

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
              onText(event.text);
              break;
            case "thinking_delta":
              onThinking?.(event.text);
              break;
            case "tool_use_start":
              onToolStart?.(event.tool);
              break;
            case "tool_executing":
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
                onActionProposal?.(event.action as ActionProposal);
              }
              break;
            case "tool_result":
              onToolResult?.(event.tool, event.result, event.input);
              break;
            case "done":
              onDone();
              return;
            case "error":
              onError(event.error);
              return;
          }
        } catch {
          // Skip malformed stream chunks.
        }
      }
    }

    onDone();
  } catch (err) {
    if (signal?.aborted) return;
    onError(err instanceof Error ? err.message : "Stream failed");
  }
}

export function buildChatTitle(firstMessage: string): string {
  const clean = firstMessage.replace(/\n/g, " ").trim();
  return clean.length > 40 ? `${clean.slice(0, 40)}...` : clean;
}
