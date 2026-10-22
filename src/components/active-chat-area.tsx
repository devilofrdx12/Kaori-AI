"use client";

import { useEffect, useRef, useState } from "react";
import MessageArea from "./message-area";
import ChatInput from "./chat-input";
import { ChatMessage, type ChatFeatureMode, type ImageDetail, type ToolResultData, type UploadFile } from "./types";
import { ChatThread } from "./chat-types";
import type { CouncilStatus } from "./model-council-progress";
import { sendMessage, type ConnectionStatus } from "@/lib/chat-api";
import ActionPassport, { type ActionProposal } from "./action-passport";


function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Failed to read processed upload"));
    reader.readAsDataURL(file);
  });
}

async function fileToDataUrl(
  file: File,
  detail: ImageDetail = "balanced"
): Promise<{ url: string; name: string; type: string; data: string; detail: ImageDetail }> {
  let payload: Blob = file;
  let type = file.type || "application/octet-stream";

  if (file.type.startsWith("image/") && file.type !== "image/gif") {
    const bitmap = await createImageBitmap(file);
    const maxDimension = detail === "fast" ? 1280 : detail === "high" ? 4096 : 2048;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const shouldPreserveOriginal = detail === "high" && file.type === "image/png"
      && scale === 1 && file.size <= 4.5 * 1024 * 1024;
    if (!shouldPreserveOriginal && (scale < 1 || file.size > 2 * 1024 * 1024 || detail !== "high")) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Image preprocessing is unavailable");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      payload = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (blob) => blob ? resolve(blob) : reject(new Error("Image compression failed")),
          detail === "high" && file.type === "image/png" ? "image/png" : "image/webp",
          detail === "fast" ? 0.78 : detail === "high" ? 0.96 : 0.86
        )
      );
      type = detail === "high" && file.type === "image/png" ? "image/png" : "image/webp";
    }
    bitmap.close();
  }

  const data = await readFileAsDataUrl(payload);
  return { url: data, name: file.name, type, data, detail };
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
  pendingPrompt: { text: string; files?: File[] | null; imageDetail?: ImageDetail; featureMode?: ChatFeatureMode; messageId?: string } | null;
  clearPendingPrompt: () => void;
}) {
  const [typing, setTyping] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [streamingThinking, setStreamingThinking] = useState("");
  const [toolInProgress, setToolInProgress] = useState<string | null>(null);
  const [toolResults, setToolResults] = useState<{ tool: string; result: string; input?: any }[]>([]);
  const [actionProposals, setActionProposals] = useState<(ActionProposal & { chatId: string })[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("online");
  const [councilStatus, setCouncilStatus] = useState<CouncilStatus>(null);

  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (connectionStatus !== "online") {
      onAvatarStateChange("thinking", false);
    } else if (toolInProgress) {
      onAvatarStateChange("shy", false);
    } else if (typing && !streamingText) {
      onAvatarStateChange("thinking", false);
    } else if (typing && streamingText) {
      onAvatarStateChange("happy", true);
    } else {
      onAvatarStateChange("idle", false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typing, !!streamingText, !!toolInProgress, connectionStatus]);

  useEffect(() => {
    if (pendingPrompt) {
      const { text, files, imageDetail, featureMode, messageId } = pendingPrompt;
      clearPendingPrompt();
      handleSendInternal(text, files, true, imageDetail, featureMode, messageId);
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
        setCouncilStatus(null);
        setConnectionStatus("online");
      }
    };
  }, [activeChat.id]);

  const handleStopRef = useRef(handleStop);
  handleStopRef.current = handleStop;

  useEffect(() => {
    const handleCancelWait = () => {
      if (connectionStatus !== "online") {
        handleStopRef.current();
      }
    };
    window.addEventListener("kaori_cancel_network_wait", handleCancelWait);
    return () => window.removeEventListener("kaori_cancel_network_wait", handleCancelWait);
  }, [connectionStatus]);

  async function handleSendInternal(
    text: string,
    files?: File[] | null,
    skipLocalAdd = false,
    imageDetail: ImageDetail = "balanced",
    featureMode: ChatFeatureMode = "auto",
    providedMessageId?: string
  ) {
    if (!text && !files?.length) return;
    if (activeChat.id.startsWith("temp-")) {
      console.warn("Please wait a moment for the new chat to initialize on the server.");
      return;
    }

    const objectUrls: string[] = [];
    const userMessageId = providedMessageId || crypto.randomUUID();

    if (!skipLocalAdd) {
      const mappedFiles = files ? files.map(f => {
        const url = URL.createObjectURL(f);
        objectUrls.push(url);
        return {
          url,
          name: f.name,
          type: f.type,
          size: f.size,
        };
      }) : undefined;

      const userMsg: ChatMessage = {
        id: userMessageId,
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
    setActionProposals([]);
    setCouncilStatus(null);
    setConnectionStatus("online");

    const controller = new AbortController();
    abortRef.current = controller;

    let fileData: UploadFile[] | undefined;
    if (files?.length) {
      fileData = await Promise.all(files.map((file) => fileToDataUrl(file, imageDetail)));
      updateChat(activeChat.id, (chat) => ({
        ...chat,
        messages: chat.messages.map((message) => {
          if (message.id !== userMessageId) return message;
          message.files?.forEach((existingFile) => {
            if (existingFile.url?.startsWith("blob:")) {
              URL.revokeObjectURL(existingFile.url);
            }
          });
          return { ...message, files: fileData };
        }),
      }));
      // Revoke blob URLs now that we have base64 data URLs — prevents memory leak
      for (const url of objectUrls) URL.revokeObjectURL(url);
    }

    let fullText = "";
    let fullThinking = "";
    const collectedToolResults: ToolResultData[] = [];
    const studyMode = typeof window !== "undefined" && localStorage.getItem("kaori_study_mode") === "true";

    const currentChatId = activeChat.id;

    try {
      await sendMessage({
        chatId: currentChatId,
        message: text,
        messageId: userMessageId,
        model,
        files: fileData,
        studyMode,
        featureMode,
        signal: controller.signal,
        onConnectionStatus: (status) => setConnectionStatus(status),
        onResetStream: () => {
          fullText = "";
          fullThinking = "";
          collectedToolResults.length = 0;
          setStreamingText("");
          setStreamingThinking("");
          setToolInProgress(null);
          setToolResults([]);
        },
        onText: (chunk) => {
          fullText += chunk;
          setStreamingText(fullText);
          setToolInProgress(null);
        },
        onThinking: (chunk) => {
          fullThinking += chunk;
          setStreamingThinking(fullThinking);
        },
        onToolStart: (tool) => setToolInProgress(tool),
        onToolExecuting: (tool) => {
          setToolInProgress(tool);
        },
        onActionProposal: (action) => {
          setActionProposals((previous) =>
            previous.some((proposal) => proposal.id === action.id && proposal.chatId === currentChatId)
              ? previous
              : [...previous, { ...action, chatId: currentChatId }]
          );
        },
        onToolResult: (tool, result, input) => {
          collectedToolResults.push({ toolName: tool, result, input });
          setToolResults((prev) => [...prev, { tool, result, input }]);
          setToolInProgress(null);
        },
        onCouncilStatus: (status) => setCouncilStatus((previous) => {
          const models = status.models || previous?.models?.map((model) =>
            model.model === status.model ? { ...model, status: status.status || model.status } : model
          );
          const activities = [...(previous?.activities ?? [])];
          for (const activity of [...(status.activities ?? []), ...(status.activity ? [status.activity] : [])]) {
            const index = activities.findIndex((item) => item.id === activity.id);
            if (index === -1) activities.push(activity);
            else activities[index] = activity;
          }
          return { ...previous, ...status, models, activities };
        }),
        onDone: () => {
          const assistantMsg: ChatMessage = {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: fullText,
            thinking: fullThinking || undefined,
            toolResults: collectedToolResults.length > 0 ? [...collectedToolResults] : undefined,
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
          setConnectionStatus("online");
          setCouncilStatus((previous) => previous ? {
            ...previous,
            phase: "complete",
            progress: 100,
            message: "Council complete — drafts and peer-review notes remain available below.",
            models: previous.models?.map((participant) => participant.status === "unavailable" ? participant : { ...participant, status: "ready" }),
          } : null);
          abortRef.current = null;
        },
        onError: (error) => {
          console.error("Chat error:", error);
          const retryable = error !== "UNAUTHORIZED" && !/invalid|required|unsupported|too large/i.test(error);
          const errMsg: ChatMessage = {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: `${error}`,
            timestamp: new Date().toISOString(),
            error: true,
            retryable,
          };
          updateChat(currentChatId, (c) => ({
            ...c,
            messages: [...c.messages, errMsg],
          }));
          setTyping(false);
          setStreamingText("");
          setStreamingThinking("");
          setToolInProgress(null);
          setCouncilStatus((previous) => previous ? {
            ...previous,
            phase: "error",
            message: "Council stopped before finishing. Completed drafts and reviews remain available below.",
          } : null);
          setConnectionStatus("online");
          abortRef.current = null;
        },
      });
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error("Send message failed", err);
      }
    }
  }

  async function handleEditSend(messageId: string, text: string, retryFiles?: UploadFile[]) {
    if (!text && !retryFiles?.length) return;

    const msgIndex = activeChat.messages.findIndex(m => m.id === messageId);
    if (msgIndex === -1) return;

    const newMessages = activeChat.messages.slice(0, msgIndex);
    const editedMsg: ChatMessage = {
      id: messageId,
      role: "user",
      content: text,
      files: retryFiles,
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
    setActionProposals([]);
    setConnectionStatus("online");

    const controller = new AbortController();
    abortRef.current = controller;

    let fullText = "";
    let fullThinking = "";
    const collectedToolResults: ToolResultData[] = [];
    const studyMode = typeof window !== "undefined" && localStorage.getItem("kaori_study_mode") === "true";
    const currentChatId = activeChat.id;

    try {
      await sendMessage({
        chatId: currentChatId,
        message: text,
        model,
        files: retryFiles,
        editMessageId: messageId,
        studyMode,
        featureMode: "auto" as const,
        signal: controller.signal,
        onConnectionStatus: (status) => setConnectionStatus(status),
        onResetStream: () => {
          fullText = "";
          fullThinking = "";
          collectedToolResults.length = 0;
          setStreamingText("");
          setStreamingThinking("");
          setToolInProgress(null);
          setToolResults([]);
        },
        onText: (chunk) => {
          fullText += chunk;
          setStreamingText(fullText);
        },
        onThinking: (chunk) => {
          fullThinking += chunk;
          setStreamingThinking(fullThinking);
        },
        onToolStart: (tool) => setToolInProgress(tool),
        onToolExecuting: (tool) => {
          setToolInProgress(tool);
        },
        onActionProposal: (action) => {
          setActionProposals((previous) =>
            previous.some((proposal) => proposal.id === action.id && proposal.chatId === currentChatId)
              ? previous
              : [...previous, { ...action, chatId: currentChatId }]
          );
        },
        onToolResult: (tool, result, input) => {
          collectedToolResults.push({ toolName: tool, result, input });
          setToolResults((prev) => [...prev, { tool, result, input }]);
          setToolInProgress(null);
        },
        onDone: () => {
          const assistantMsg: ChatMessage = {
            id: `asst-${Date.now()}`,
            role: "assistant",
            content: fullText,
            thinking: fullThinking || undefined,
            toolResults: collectedToolResults.length > 0 ? [...collectedToolResults] : undefined,
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
          setConnectionStatus("online");
          abortRef.current = null;
        },
        onError: (error) => {
          console.error("Edit chat error:", error);
          const retryable = error !== "UNAUTHORIZED" && !/invalid|required|unsupported|too large/i.test(error);
          const errMsg: ChatMessage = {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: `${error}`,
            timestamp: new Date().toISOString(),
            error: true,
            retryable,
          };
          updateChat(currentChatId, (c) => ({
            ...c,
            messages: [...c.messages, errMsg],
          }));
          setTyping(false);
          setStreamingText("");
          setStreamingThinking("");
          setToolInProgress(null);
          setConnectionStatus("online");
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
      setConnectionStatus("online");

      const msg: ChatMessage = {
        id: `stopped-${Date.now()}`,
        role: "assistant",
        content: streamingText || "",
        thinking: streamingThinking || undefined,
        timestamp: new Date().toISOString(),
        stopped: true,
      };
      updateChat(activeChat.id, (c) => ({
        ...c,
        messages: [...c.messages, msg],
      }));

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
        connectionStatus={connectionStatus}
        onEditSubmit={handleEditSend}
        onRetryMessage={(message) => void handleEditSend(message.id, message.content, message.files)}
        streamingText={streamingText}
        streamingThinking={streamingThinking}
        councilStatus={councilStatus}
        onDismissCouncil={() => setCouncilStatus(null)}
        onStop={handleStop}
        bottomRef={bottomRef}
      />
      {actionProposals
        .filter((proposal) => proposal.chatId === activeChat.id)
        .map((action) => (
          <ActionPassport
            key={action.id}
            action={action}
            onDismiss={(id) =>
              setActionProposals((previous) => previous.filter((proposal) => proposal.id !== id))
            }
          />
        ))}
      <div className="w-full shrink-0 animate-spring-down transition-all will-change-transform transform-gpu duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]">
        <ChatInput
          onSend={(t, f, detail, feature) => handleSendInternal(t, f, false, detail, feature)}
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
