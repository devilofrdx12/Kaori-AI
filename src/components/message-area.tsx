"use client";

import { useState, useMemo } from "react";
import { Virtuoso } from "react-virtuoso";
import Image from "next/image";
import { WifiOff, RefreshCw } from "lucide-react";
import { ChatMessage } from "./types";
import ModelCouncilProgress, { type CouncilStatus } from "./model-council-progress";
import type { ConnectionStatus } from "@/lib/chat-api";
import TypingIndicator from "./typing-indicator";
import ThinkingIndicator from "./thinking-indicator";
import ToolResultCard from "./tool-result-card";
import { MessageRow } from "./message-row";



export default function MessageArea({
  messages = [],
  typing,
  toolInProgress,
  toolResults,
  connectionStatus = "online",
  streamingText,
  streamingThinking,
  councilStatus,
  onDismissCouncil,
  onEditSubmit,
  onRetryMessage,
  onStop,
  bottomRef,
}: {
  messages?: ChatMessage[];
  typing: boolean;
  toolInProgress?: string | null;
  toolResults?: { tool: string; result: string }[];
  connectionStatus?: ConnectionStatus;
  streamingText?: string;
  streamingThinking?: string;
  councilStatus?: CouncilStatus;
  onDismissCouncil?: () => void;
  onEditSubmit?: (messageId: string, newText: string) => void;
  onRetryMessage?: (message: ChatMessage) => void;
  onStop?: () => void;
  bottomRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");


  const allMessages = useMemo(() => {
    // Strip XML tool calls (complete or partial during streaming) from visibility
    const stripToolCalls = (text: string) => {
      if (!text || !text.includes("<tool_call>")) return text;
      return text.replace(/<tool_call>[\s\S]*?(?:<\/tool_call>|$)/g, "").trim();
    };

    const msgs = messages.map(m => ({
      ...m,
      content: stripToolCalls(m.content),
    }));

    if (streamingText || streamingThinking) {
      msgs.push({
        id: "__streaming__",
        role: "assistant",
        content: stripToolCalls(streamingText || ""),
      });
    }
    return msgs;
  }, [messages, streamingText, streamingThinking]);

  

  const copyMessage = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  if (allMessages.length === 0 && !typing && !toolInProgress) {
    return null; // Empty state is handled by ChatLayout
  }

  const handleRegenerate = (id: string) => {
    const idx = allMessages.findIndex((m) => m.id === id);
    if (idx > 0 && (onRetryMessage || onEditSubmit)) {
      // Find the last user message before this stopped message
      for (let i = idx - 1; i >= 0; i--) {
        if (allMessages[i].role === "user") {
          const userMsg = allMessages[i];
          if (onRetryMessage) onRetryMessage(userMsg);
          else onEditSubmit?.(userMsg.id, userMsg.content);
          break;
        }
      }
    }
  };

  const renderItem = (index: number, msg: ChatMessage) => (
    <div
      className="max-w-3xl mx-auto py-0.5"
    >
      <MessageRow
        msg={msg}
        isEditing={editingMessageId === msg.id}
        editText={editText}
        setEditText={setEditText}
        setEditingMessageId={setEditingMessageId}
        onEditSubmit={onEditSubmit}
        isCopied={copiedId === msg.id}
        copyMessage={copyMessage}
        streamingThinking={msg.id === "__streaming__" ? streamingThinking : undefined}
        onRegenerate={handleRegenerate}
      />
    </div>
  );

  return (
    <div className="flex-1 min-h-0 px-3 sm:px-5 py-4 sm:py-6 relative">
      <Virtuoso
        className="h-full"

        data={allMessages}
        computeItemKey={(_, msg) => msg.id}
        alignToBottom
        followOutput="smooth"
        overscan={200}
        itemContent={renderItem}
        components={{
          Footer: () => (
            <div className="max-w-3xl mx-auto space-y-1">
              {/* Network interruption / auto-reconnect status banner */}
              {connectionStatus !== "online" && (
                <div
                  role="status"
                  aria-live="polite"
                  className={`my-2 flex items-center gap-3 rounded-2xl border px-4 py-3 text-xs sm:text-sm backdrop-blur-xl animate-fade-in ${
                    connectionStatus === "waiting_for_network"
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200"
                      : "border-primary/30 bg-primary/10 text-primary"
                  }`}
                >
                  {connectionStatus === "waiting_for_network" ? (
                    <WifiOff size={16} className="shrink-0 animate-pulse text-amber-600 dark:text-amber-400" />
                  ) : (
                    <RefreshCw size={16} className="shrink-0 animate-spin text-primary" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">
                      {connectionStatus === "waiting_for_network"
                        ? "Connection lost — waiting for internet to resume…"
                        : "Back online — syncing response…"}
                    </div>
                    {connectionStatus === "waiting_for_network" && (
                      <div className="mt-0.5 text-[11px] opacity-80">
                        Your request will automatically continue as soon as you reconnect.
                      </div>
                    )}
                  </div>

                  {connectionStatus === "waiting_for_network" && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          if (typeof window !== "undefined") {
                            window.dispatchEvent(new Event("online"));
                          }
                        }}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-100 transition-colors active:scale-95"
                        title="Retry connection now"
                      >
                        <RefreshCw size={12} className="shrink-0" />
                        <span>Reconnect</span>
                      </button>
                      {onStop && (
                        <button
                          type="button"
                          onClick={onStop}
                          className="px-2 py-1 rounded-xl text-xs font-medium hover:bg-amber-500/15 text-amber-800 dark:text-amber-200 transition-colors"
                          title="Cancel waiting"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Tool results — only show before text starts streaming */}
              {!streamingText && toolResults?.map((tr, i) => (
                <ToolResultCard key={`tr-${i}`} toolName={tr.tool} result={tr.result} />
              ))}

              {/* Tool in progress */}
              {toolInProgress && connectionStatus === "online" && <ThinkingIndicator toolName={toolInProgress} />}

              {councilStatus && connectionStatus === "online" && (
                <ModelCouncilProgress status={councilStatus} onDismiss={onDismissCouncil} />
              )}

              {/* Typing indicator — hidden when thinking block or offline banner is shown */}
              {typing && connectionStatus === "online" && !streamingText && !streamingThinking && !toolInProgress && <TypingIndicator />}

              {/* End of conversation marker */}
              {!typing && !toolInProgress && allMessages.length > 0 && (
                <div className="flex justify-start pt-6 pb-2 select-none pointer-events-none pl-3 sm:pl-0">
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full overflow-hidden shadow-md transition-all duration-500">
                    <Image src="/kaori-avatar.png" alt="" width={28} height={28} className="w-full h-full object-cover" />
                  </div>
                </div>
              )}

              {/* Scroll anchor */}
              <div ref={bottomRef} className="h-4" />
            </div>
          ),
        }}
      />
    </div>
  );
}
