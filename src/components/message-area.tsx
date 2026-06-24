"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Copy, Check, User, Pencil } from "lucide-react";
import { ChatMessage } from "./types";
import CodeBlock from "./code-block";
import TypingIndicator from "./typing-indicator";
import ThinkingIndicator from "./thinking-indicator";
import ToolResultCard from "./tool-result-card";

export default function MessageArea({
  messages = [],
  typing,
  toolInProgress,
  toolResults,
  streamingText,
  onEditSubmit,
  bottomRef,
}: {
  messages?: ChatMessage[];
  typing: boolean;
  toolInProgress?: string | null;
  toolResults?: { tool: string; result: string }[];
  streamingText?: string;
  onEditSubmit?: (messageId: string, newText: string) => void;
  bottomRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const copyMessage = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  const allMessages = [...messages];
  if (streamingText) {
    allMessages.push({
      id: "__streaming__",
      role: "assistant",
      content: streamingText,
    });
  }

  if (allMessages.length === 0 && !typing && !toolInProgress) {
    return null; // Empty state is handled by ChatLayout
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-5 py-4 sm:py-6">
      <div className="max-w-3xl mx-auto space-y-1">
        <AnimatePresence initial={false}>
          {allMessages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ type: "spring", stiffness: 400, damping: 28, mass: 0.8 }}
              className="group relative"
            >
              {msg.role === "user" ? (
                /* ── USER MESSAGE ── */
                <div className="flex justify-end mb-4">
                  <div className="max-w-[min(88%,44rem)] flex items-end gap-2">
                    {editingMessageId === msg.id ? (
                      <div className="w-full flex flex-col gap-2 glass-panel p-4 rounded-2xl">
                        <textarea
                          title="Edit message"
                          placeholder="Edit message"
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="w-full min-h-[100px] bg-transparent text-on-surface text-sm resize-none outline-none font-body"
                        />
                        <div className="flex justify-end gap-2 mt-2">
                          <button 
                            onClick={() => setEditingMessageId(null)}
                            className="px-3 py-1.5 text-xs font-medium rounded-xl hover:bg-white/55 dark:hover:bg-white/10 text-secondary hover-lift active-press"
                          >Cancel</button>
                          <button 
                            onClick={() => {
                              if (onEditSubmit && editText.trim() !== msg.content) {
                                onEditSubmit(msg.id, editText);
                              }
                              setEditingMessageId(null);
                            }}
                            disabled={!editText.trim() || editText === msg.content}
                            className="px-3 py-1.5 text-xs font-medium rounded-xl bg-primary text-white disabled:opacity-50 disabled:hover-lift-none disabled:active-press-none hover-lift active-press"
                          >Save & Submit</button>
                        </div>
                      </div>
                    ) : (
                      <div className="group/user flex flex-col items-end gap-1">
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => {
                              setEditingMessageId(msg.id);
                              setEditText(msg.content);
                            }}
                            title="Edit"
                            className="p-1.5 rounded-full text-secondary opacity-0 group-hover/user:opacity-100 hover:bg-white/55 dark:hover:bg-white/10 hover:text-on-surface hover-lift active-press"
                          >
                            <Pencil size={14} />
                          </button>
                          <div className="px-4 sm:px-5 py-3 rounded-[1.5rem] rounded-br-md neumorphic-raised bg-background text-on-surface text-[15px] leading-relaxed whitespace-pre-wrap break-words font-body">
                            {msg.content}
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="w-7 h-7 rounded-full bg-white/40 dark:bg-black/40 flex items-center justify-center shrink-0 glass-border">
                      <User size={14} className="text-secondary" />
                    </div>
                  </div>
                </div>
              ) : (
                /* ── ASSISTANT MESSAGE ── */
                <div className="flex flex-col mb-4">
                  <div className="flex items-end gap-3">
                    <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 border border-[hsl(var(--border))]">
                      <Image src="/kaori-avatar.png" alt="Kaori" width={28} height={28} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      {msg.toolResults?.map((tr, i) => (
                        <ToolResultCard
                          key={i}
                          toolName={tr.toolName}
                          result={typeof tr.result === "string" ? tr.result : JSON.stringify(tr.result)}
                        />
                      ))}

                      <div className="glass-panel p-4 sm:p-5 rounded-[1.5rem] rounded-bl-md transition-colors duration-300">
                        <div className="prose dark:prose-invert max-w-none">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[[rehypeHighlight, { ignoreMissing: true }]]}
                            components={{
                              pre: ({ children }) => <>{children}</>,
                              code: ({ className, children, ...rest }) => {
                                const isBlock = /language-(\w+)/.test(className || "");
                                if (isBlock) {
                                  return (
                                    <CodeBlock className={className}>
                                      {children}
                                    </CodeBlock>
                                  );
                                }
                                return (
                                    <code
                                      className="bg-white/65 dark:bg-black/45 text-on-surface px-1.5 py-0.5 rounded-md text-[13px] font-mono border border-white/20 break-words"
                                      {...rest}
                                    >
                                      {children}
                                    </code>
                                );
                              },
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Copy button */}
                  {msg.id !== "__streaming__" && (
                    <div className="pl-10">
                      <button
                        onClick={() => copyMessage(msg.id, msg.content)}
                        className="mt-2 flex items-center gap-1 text-xs text-secondary hover:text-on-surface opacity-0 group-hover:opacity-100 hover-lift active-press"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check size={12} className="text-green-400" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy size={12} />
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Tool results during streaming */}
        {toolResults?.map((tr, i) => (
          <ToolResultCard key={`tr-${i}`} toolName={tr.tool} result={tr.result} />
        ))}

        {/* Tool in progress */}
        {toolInProgress && <ThinkingIndicator toolName={toolInProgress} />}

        {/* Typing indicator */}
        {typing && !streamingText && !toolInProgress && <TypingIndicator />}

        {/* Scroll anchor */}
        <div ref={bottomRef} className="h-4" />
      </div>
    </div>
  );
}
