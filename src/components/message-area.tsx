"use client";

import { useState, useMemo } from "react";
import { Virtuoso } from "react-virtuoso";
import Image from "next/image";
import { ChatMessage } from "./types";
import TypingIndicator from "./typing-indicator";
import ThinkingIndicator from "./thinking-indicator";
import ToolResultCard from "./tool-result-card";
import { MessageRow } from "./message-row";



export default function MessageArea({
  messages = [],
  typing,
  toolInProgress,
  toolResults,
  streamingText,
  streamingThinking,
  onEditSubmit,
  onRetryMessage,
  bottomRef,
}: {
  messages?: ChatMessage[];
  typing: boolean;
  toolInProgress?: string | null;
  toolResults?: { tool: string; result: string }[];
  streamingText?: string;
  streamingThinking?: string;
  onEditSubmit?: (messageId: string, newText: string) => void;
  onRetryMessage?: (message: ChatMessage) => void;
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
              {/* Tool results — only show before text starts streaming */}
              {!streamingText && toolResults?.map((tr, i) => (
                <ToolResultCard key={`tr-${i}`} toolName={tr.tool} result={tr.result} />
              ))}

              {/* Tool in progress */}
              {toolInProgress && <ThinkingIndicator toolName={toolInProgress} />}

              {/* Typing indicator — hidden when thinking block is shown */}
              {typing && !streamingText && !streamingThinking && !toolInProgress && <TypingIndicator />}

              {/* Scroll anchor */}
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
