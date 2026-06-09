import { UploadFile } from "@/components/types";

export type ChatThreadSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

// ── Common headers (CSRF protection) ──
const AJAX_HEADERS: HeadersInit = {
  "X-Requested-With": "XMLHttpRequest",
};

async function jsonOrThrow(res: Response) {
  const text = await res.text();

  // If unauthorized, try silent refresh before giving up
  if (res.status === 401) {
    const refreshed = await silentRefresh();
    if (!refreshed) throw new Error("UNAUTHORIZED");
    // Signal caller to retry — but we throw so caller can handle
    throw new Error("TOKEN_REFRESHED");
  }

  if (!res.ok) {
    const data = text ? JSON.parse(text) : {};
    throw new Error(data.error || "Request failed");
  }
  return text ? JSON.parse(text) : null;
}

/**
 * Attempt to silently refresh the access token.
 * Returns true if refresh succeeded.
 */
async function silentRefresh(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Fetch with automatic retry after token refresh.
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit
): Promise<Response> {
  const res = await fetch(url, { ...init, credentials: "include" });

  if (res.status === 401) {
    const refreshed = await silentRefresh();
    if (refreshed) {
      // Retry the original request
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
    const data = text ? JSON.parse(text) : {};
    throw new Error(data.error || "Request failed");
  }
  return text ? JSON.parse(text) : null;
}

export async function listChats(): Promise<ChatThreadSummary[]> {
  return jsonFetchWithRetry("/api/chats", {
    headers: AJAX_HEADERS,
    cache: "no-store",
  });
}

export async function createChat(title?: string): Promise<ChatThreadSummary> {
  return jsonFetchWithRetry("/api/chats", {
    method: "POST",
    headers: { ...AJAX_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({ title: title ?? "New chat" }),
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

export async function sendMessage({
  chatId,
  message,
  model,
  files,
  onText,
  onToolStart,
  onToolExecuting,
  onToolResult,
  onDone,
  onError,
  signal,
}: {
  chatId: string;
  message: string;
  model: string;
  files?: UploadFile[];
  onText: (text: string) => void;
  onToolStart?: (tool: string) => void;
  onToolExecuting?: (tool: string, input: unknown) => void;
  onToolResult?: (tool: string, result: string) => void;
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
      body: JSON.stringify({ chatId, message, model, files }),
      signal,
    });

    // Auto-refresh on 401
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
          body: JSON.stringify({ chatId, message, model, files }),
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
            case "tool_use_start":
              onToolStart?.(event.tool);
              break;
            case "tool_executing":
              onToolExecuting?.(event.tool, event.input);
              break;
            case "tool_result":
              onToolResult?.(event.tool, event.result);
              break;
            case "done":
              onDone();
              return;
            case "error":
              onError(event.error);
              return;
          }
        } catch {
          // skip
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
  return clean.length > 40 ? clean.slice(0, 40) + "…" : clean;
}
