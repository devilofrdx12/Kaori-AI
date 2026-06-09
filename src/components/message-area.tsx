"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Copy, Check, User } from "lucide-react";
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
}: {
  messages?: ChatMessage[];
  typing: boolean;
  toolInProgress?: string | null;
  toolResults?: { tool: string; result: string }[];
  streamingText?: string;
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
    <div className="flex-1 overflow-y-auto px-4 py-6">
      <div className="max-w-3xl mx-auto space-y-1">
        <AnimatePresence initial={false}>
          {allMessages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="group relative"
            >
              {msg.role === "user" ? (
                /* ── USER MESSAGE ── */
                <div className="flex justify-end mb-4">
                  <div className="max-w-[80%] flex items-start gap-2">
                    <div className="px-4 py-3 rounded-2xl rounded-br-md bg-[hsl(var(--primary))] text-white text-sm leading-relaxed">
                      {msg.content}
                    </div>
                    <div className="w-7 h-7 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center shrink-0 mt-0.5">
                      <User size={14} className="text-[hsl(var(--muted-foreground))]" />
                    </div>
                  </div>
                </div>
              ) : (
                /* ── ASSISTANT MESSAGE ── */
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-7 h-7 rounded-full claude-gradient flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">
                    K
                  </div>
                  <div className="flex-1 min-w-0">
                    {/* Tool results */}
                    {msg.toolResults?.map((tr, i) => (
                      <ToolResultCard
                        key={i}
                        toolName={tr.toolName}
                        result={typeof tr.result === "string" ? tr.result : JSON.stringify(tr.result)}
                      />
                    ))}

                    <div className="prose dark:prose-invert max-w-none">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeHighlight]}
                        components={{
                          code: ({ className, children, ...rest }) => {
                            const isBlock = className?.startsWith("language-");
                            if (isBlock) {
                              return (
                                <CodeBlock className={className}>
                                  {children}
                                </CodeBlock>
                              );
                            }
                            return (
                              <code
                                className="bg-[hsl(var(--muted))] px-1.5 py-0.5 rounded text-sm font-mono"
                                {...rest}
                              >
                                {children}
                              </code>
                            );
                          },
                          pre: ({ children }) => <>{children}</>,
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>

                    {/* Copy button */}
                    {msg.id !== "__streaming__" && (
                      <button
                        onClick={() => copyMessage(msg.id, msg.content)}
                        className="mt-2 flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors opacity-0 group-hover:opacity-100"
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
                    )}
                  </div>
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
      </div>
    </div>
  );
}
