"use client";

import { useEffect, useRef, useState } from "react";
import MessageArea from "./message-area";
import ChatInput from "./chat-input";
import { ChatMessage } from "./types";
import { ChatThread } from "./chat-types";
import { sendMessage } from "@/lib/chat-api";

const BLOCKED_CUSTOM_URI_PROTOCOLS = new Set([
  "about:", "blob:", "chrome:", "chrome-extension:", "data:", "devtools:",
  "edge:", "file:", "filesystem:", "http:", "https:", "javascript:", "vbscript:",
]);

// Exact hostnames that are permitted when the open_youtube tool fires.
const YOUTUBE_ALLOWED_HOSTS = new Set([
  "www.youtube.com",
  "youtu.be",
  "youtube.com",
  "m.youtube.com",
]);

/**
 * Extracts the first https: URL from tool result text whose hostname is in
 * YOUTUBE_ALLOWED_HOSTS. Returns null when nothing trustworthy is found.
 */
function extractYouTubeUrl(result: string): string | null {
  // Split on whitespace so we inspect discrete tokens, not substrings.
  for (const token of result.split(/\s+/)) {
    try {
      const url = new URL(token);
      if (url.protocol === "https:" && YOUTUBE_ALLOWED_HOSTS.has(url.hostname)) {
        return url.toString();
      }
    } catch {
      // token wasn't a valid URL – keep scanning
    }
  }
  return null;
}

function getSafeCustomUri(value: unknown) {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const parsed = new URL(value);
    const protocol = parsed.protocol.toLowerCase();
    if (!/^[a-z][a-z0-9+.-]*:$/.test(protocol)) return null;
    if (BLOCKED_CUSTOM_URI_PROTOCOLS.has(protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function navigateToCustomUri(value: unknown) {
  const uri = getSafeCustomUri(value);
  if (!uri) return false;
  window.location.href = uri;
  return true;
}

function openSafeHttpsUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const opened = window.open(url.toString(), "_blank", "noopener,noreferrer");
    if (opened) opened.opener = null;
    return true;
  } catch {
    return false;
  }
}

async function fileToDataUrl(
  file: File
): Promise<{ url: string; name: string; type: string; data: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const data = typeof reader.result === "string" ? reader.result : "";
      resolve({
        url: data,
        name: file.name,
        type: file.type || "application/octet-stream",
        data,
      });
    };
    reader.onerror = () => reject(new Error(`Failed to read: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export default function ActiveChatArea({
  activeChat,
  model,
  setModel,
  updateChat,
  onAvatarStateChange,
  pendingPrompt,
  clearPendingPrompt,
}: {
  activeChat: ChatThread;
  model: string;
  setModel: (m: string) => void;
  updateChat: (id: string, updater: (c: ChatThread) => ChatThread) => void;
  onAvatarStateChange: (emotion: any, speaking: boolean) => void;
  pendingPrompt: { text: string; files?: File[] | null } | null;
  clearPendingPrompt: () => void;
}) {
  const [typing, setTyping] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [streamingThinking, setStreamingThinking] = useState("");
  const [toolInProgress, setToolInProgress] = useState<string | null>(null);
  const [toolResults, setToolResults] = useState<{ tool: string; result: string }[]>([]);
  
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (toolInProgress) {
      onAvatarStateChange("shy", false);
    } else if (typing && !streamingText) {
      onAvatarStateChange("thinking", false);
    } else if (typing && streamingText) {
      onAvatarStateChange("happy", true);
    } else {
      onAvatarStateChange("idle", false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typing, !!streamingText, !!toolInProgress]);

  useEffect(() => {
    if (pendingPrompt) {
      const { text, files } = pendingPrompt;
      clearPendingPrompt();
      handleSendInternal(text, files, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPrompt]);

  // Handle cross-chat abort
  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
        setTyping(false);
        setStreamingText("");
        setToolInProgress(null);
      }
    };
  }, [activeChat.id]);

  async function handleSendInternal(text: string, files?: File[] | null, skipLocalAdd = false) {
    if (!text && !files?.length) return;
    if (activeChat.id.startsWith("temp-")) {
      console.warn("Please wait a moment for the new chat to initialize on the server.");
      return;
    }

    if (!skipLocalAdd) {
      const mappedFiles = files ? files.map(f => ({
        url: URL.createObjectURL(f),
        name: f.name,
        type: f.type,
        size: f.size
      })) : undefined;
      
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text,
        files: mappedFiles,
        timestamp: new Date().toISOString(),
      };
      updateChat(activeChat.id, (c) => ({
        ...c,
        messages: [...c.messages, userMsg],
        updatedAt: new Date().toISOString(),
      }));
    }

    setTyping(true);
    setStreamingText("");
    setStreamingThinking("");
    setToolInProgress(null);
    setToolResults([]);

    const controller = new AbortController();
    abortRef.current = controller;

    let fileData;
    if (files?.length) {
      fileData = await Promise.all(files.map(fileToDataUrl));
    }

    let fullText = "";
    const studyMode = typeof window !== "undefined" && localStorage.getItem("kaori_study_mode") === "true";

    const currentChatId = activeChat.id;

    try {
      await sendMessage({
        chatId: currentChatId,
        message: text,
        model,
        files: fileData,
        studyMode,
        signal: controller.signal,
        onText: (chunk) => {
          fullText += chunk;
          setStreamingText(fullText);
          setToolInProgress(null);
        },
        onThinking: (chunk) => {
          setStreamingThinking(prev => prev + chunk);
        },
        onToolStart: (tool) => setToolInProgress(tool),
        onToolExecuting: (tool, input) => {
          setToolInProgress(tool);
          if (tool === "open_application" && input && typeof input === "object") {
            const { uriScheme, fallbackUrl } = input as { uriScheme?: string; fallbackUrl?: string; };
            if (navigateToCustomUri(uriScheme)) {
              setTimeout(() => openSafeHttpsUrl(fallbackUrl), 1500);
            }
          }
        },
        onToolResult: (tool, result) => {
          setToolResults((prev) => [...prev, { tool, result }]);
          setToolInProgress(null);
          if (tool === "play_spotify" && result.includes("spotify:")) {
            const match = result.match(/(spotify:[a-zA-Z0-9:]+)/);
            if (match) navigateToCustomUri(match[1]);
          }
          if (tool === "open_youtube") {
            const ytUrl = extractYouTubeUrl(result);
            if (ytUrl) openSafeHttpsUrl(ytUrl);
          }
        },
        onDone: () => {
          const assistantMsg: ChatMessage = {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: fullText,
            timestamp: new Date().toISOString(),
          };
          updateChat(currentChatId, (c) => ({
            ...c,
            messages: [...c.messages, assistantMsg],
            updatedAt: new Date().toISOString(),
          }));
          setTyping(false);
          setStreamingText("");
          setStreamingThinking("");
          setToolInProgress(null);
          setToolResults([]);
          abortRef.current = null;
        },
        onError: (error) => {
          console.error("Chat error:", error);
          const errMsg: ChatMessage = {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: `⚠️ **Error:** ${error}`,
            timestamp: new Date().toISOString(),
          };
          updateChat(currentChatId, (c) => ({
            ...c,
            messages: [...c.messages, errMsg],
          }));
          setTyping(false);
          setStreamingText("");
          setStreamingThinking("");
          setToolInProgress(null);
          abortRef.current = null;
        },
      });
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error("Send message failed", err);
      }
    }
  }

  async function handleEditSend(messageId: string, text: string) {
    if (!text) return;
    
    const msgIndex = activeChat.messages.findIndex(m => m.id === messageId);
    if (msgIndex === -1) return;

    const newMessages = activeChat.messages.slice(0, msgIndex);
    const editedMsg: ChatMessage = {
      id: messageId,
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };
    newMessages.push(editedMsg);

    updateChat(activeChat.id, (c) => ({
      ...c,
      messages: newMessages,
      updatedAt: new Date().toISOString(),
    }));

    setTyping(true);
    setStreamingText("");
    setStreamingThinking("");
    setToolInProgress(null);
    setToolResults([]);

    const controller = new AbortController();
    abortRef.current = controller;

    let fullText = "";
    const studyMode = typeof window !== "undefined" && localStorage.getItem("kaori_study_mode") === "true";
    const currentChatId = activeChat.id;

    try {
      await sendMessage({
        chatId: currentChatId,
        message: text,
        model,
        editMessageId: messageId,
        studyMode,
        signal: controller.signal,
        onText: (chunk) => {
          fullText += chunk;
          setStreamingText(fullText);
        },
        onThinking: (chunk) => {
          setStreamingThinking(prev => prev + chunk);
        },
        onToolStart: (tool) => setToolInProgress(tool),
        onToolExecuting: (tool) => {
          setToolInProgress(tool);
          // same application logic
        },
        onToolResult: (tool, result) => {
          setToolResults((prev) => [...prev, { tool, result }]);
          setToolInProgress(null);
        },
        onDone: () => {
          const assistantMsg: ChatMessage = {
            id: `asst-${Date.now()}`,
            role: "assistant",
            content: fullText,
            timestamp: new Date().toISOString(),
          };
          updateChat(currentChatId, (c) => ({
            ...c,
            messages: [...c.messages, assistantMsg],
          }));
          setTyping(false);
          setStreamingText("");
          setStreamingThinking("");
          setToolInProgress(null);
          setToolResults([]);
          abortRef.current = null;
        },
        onError: (err) => {
          console.error(err);
          setTyping(false);
          abortRef.current = null;
        },
      });
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error("Edit message failed", err);
      }
    }
  }

  function handleStop() {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      setTyping(false);

      if (streamingText) {
        const msg: ChatMessage = {
          id: `stopped-${Date.now()}`,
          role: "assistant",
          content: streamingText + "\n\n*[Generation stopped]*",
          timestamp: new Date().toISOString(),
        };
        updateChat(activeChat.id, (c) => ({
          ...c,
          messages: [...c.messages, msg],
        }));
      }
      setStreamingText("");
      setStreamingThinking("");
      setToolInProgress(null);
    }
  }

  return (
    <>
      <MessageArea
        messages={activeChat.messages}
        typing={typing}
        toolInProgress={toolInProgress}
        toolResults={toolResults}
        onEditSubmit={handleEditSend}
        streamingText={streamingText}
        streamingThinking={streamingThinking}
        bottomRef={bottomRef}
      />
      <div className="w-full shrink-0 animate-spring-down transition-all will-change-transform transform-gpu duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]">
        <ChatInput
          onSend={(t, f) => handleSendInternal(t, f)}
          disabled={typing}
          onStop={handleStop}
          model={model}
          onModelChange={setModel}
          placeholder="Reply to Kaori"
        />
      </div>
    </>
  );
}
