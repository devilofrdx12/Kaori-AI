"use client";

import { memo, useState, useMemo } from "react";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Copy, Check, User, Pencil, ChevronDown, Brain } from "lucide-react";
import { ChatMessage } from "./types";
import CodeBlock from "./code-block";
import TypingIndicator from "./typing-indicator";
import ThinkingIndicator from "./thinking-indicator";
import ToolResultCard from "./tool-result-card";
import type { Components } from "react-markdown";

/* ── Collapsible thinking block (Claude-style) ── */
function ThinkingBlock({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-xs text-secondary hover:text-on-surface transition-colors group select-none"
      >
        <Brain
          size={13}
          className={`shrink-0 text-[hsl(var(--primary))] ${isStreaming ? "animate-pulse" : ""}`}
        />
        <span className="font-medium">
          {isStreaming ? "Thinking…" : "Thought process"}
        </span>
        <ChevronDown
          size={13}
          className={`shrink-0 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="mt-2 pl-5 border-l-2 border-[hsl(var(--primary)/0.3)] animate-fade-in">
          <p className="text-xs leading-relaxed text-secondary whitespace-pre-wrap font-mono max-h-72 overflow-y-auto">
            {content}
          </p>
        </div>
      )}
    </div>
  );
}

const memoizedRemarkPlugins = [remarkGfm];
const memoizedRehypePlugins = [[rehypeHighlight, { ignoreMissing: true }]] as any;

const memoizedComponents: Components = {
  pre: ({ children }: any) => <>{children}</>,
  code: ({ className, children, ...rest }: any) => {
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
};

const MessageRow = memo((
{
  msg,
  isEditing,
  editText,
  setEditText,
  setEditingMessageId,
  onEditSubmit,
  isCopied,
  copyMessage,
  streamingThinking,
}: {
  msg: ChatMessage;
  isEditing: boolean;
  editText: string;
  setEditText: (v: string) => void;
  setEditingMessageId: (id: string | null) => void;
  onEditSubmit?: (messageId: string, newText: string) => void;
  isCopied: boolean;
  copyMessage: (id: string, text: string) => void;
  streamingThinking?: string;
}) => {
  return (
    <div className="message-enter group relative">
      {msg.role === "user" ? (
        /* ── USER MESSAGE ── */
        <div className="flex justify-end mb-4">
          <div className="max-w-[min(88%,44rem)] flex items-end gap-2">
            {isEditing ? (
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
                    className="p-1.5 rounded-full text-secondary opacity-60 sm:opacity-0 group-hover/user:opacity-100 hover:bg-white/55 dark:hover:bg-white/10 hover:text-on-surface hover-lift active-press"
                  >
                    <Pencil size={14} />
                  </button>
                  <div className="flex flex-col gap-2 w-full max-w-full items-end">
                    {msg.files && msg.files.length > 0 && (
                      <div className="flex flex-wrap gap-2 justify-end mb-1">
                        {msg.files.map((f, i) => (
                          <div key={i} className="flex items-center gap-2 p-2 rounded-xl bg-white/60 dark:bg-white/10 border border-black/5 dark:border-white/10 shadow-sm max-w-full overflow-hidden">
                            {f.type.startsWith("image/") ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img src={f.url} alt={f.name} className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-md" />
                            ) : (
                              <div className="flex items-center gap-2 px-1">
                                <span className="text-2xl">📄</span>
                                <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300 max-w-[120px] truncate">{f.name}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {msg.content && (
                      <div className="px-4 sm:px-5 py-3 rounded-[1.5rem] rounded-br-md neumorphic-raised bg-background text-on-surface text-[15px] leading-relaxed whitespace-pre-wrap break-words font-body">
                        {msg.content}
                      </div>
                    )}
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
                {/* Show thinking block if this is the streaming message with thinking, or a saved message with thinking */}
                {(streamingThinking || msg.thinking) && (
                  <ThinkingBlock
                    content={streamingThinking || msg.thinking || ""}
                    isStreaming={!!streamingThinking}
                  />
                )}
                <div className="prose dark:prose-invert max-w-none">
                  <ReactMarkdown
                    remarkPlugins={memoizedRemarkPlugins}
                    rehypePlugins={memoizedRehypePlugins}
                    components={memoizedComponents}
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
                className="mt-2 flex items-center gap-1 text-xs text-secondary hover:text-on-surface opacity-60 sm:opacity-0 sm:group-hover:opacity-100 hover-lift active-press"
              >
                {isCopied ? (
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
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.msg.content === nextProps.msg.content &&
    prevProps.isEditing === nextProps.isEditing &&
    (prevProps.isEditing ? prevProps.editText === nextProps.editText : true) &&
    prevProps.isCopied === nextProps.isCopied &&
    prevProps.streamingThinking === nextProps.streamingThinking &&
    prevProps.msg.toolResults?.length === nextProps.msg.toolResults?.length
  );
});
MessageRow.displayName = "MessageRow";

import { Virtuoso } from "react-virtuoso";

export default function MessageArea({
  messages = [],
  typing,
  toolInProgress,
  toolResults,
  streamingText,
  streamingThinking,
  onEditSubmit,
  bottomRef,
}: {
  messages?: ChatMessage[];
  typing: boolean;
  toolInProgress?: string | null;
  toolResults?: { tool: string; result: string }[];
  streamingText?: string;
  streamingThinking?: string;
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

  const allMessages = useMemo(() => {
    const msgs = [...messages];
    if (streamingText || streamingThinking) {
      msgs.push({
        id: "__streaming__",
        role: "assistant",
        content: streamingText || "",
      });
    }
    return msgs;
  }, [messages, streamingText, streamingThinking]);

  if (allMessages.length === 0 && !typing && !toolInProgress) {
    return null; // Empty state is handled by ChatLayout
  }

  const renderItem = (index: number, msg: ChatMessage) => (
    <div className="max-w-3xl mx-auto py-0.5 cv-auto">
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
      />
    </div>
  );

  return (
    <div className="flex-1 min-h-0 px-3 sm:px-5 py-4 sm:py-6 relative will-change-transform [clip-path:polygon(-100vw_0,200vw_0,200vw_200vh,-100vw_200vh)]">
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
              {/* Tool results during streaming */}
              {toolResults?.map((tr, i) => (
                <ToolResultCard key={`tr-${i}`} toolName={tr.tool} result={tr.result} />
              ))}

              {/* Tool in progress */}
              {toolInProgress && <ThinkingIndicator toolName={toolInProgress} />}

              {/* Typing indicator — hidden when thinking block is shown */}
              {typing && !streamingText && !streamingThinking && !toolInProgress && <TypingIndicator />}

              {/* Scroll anchor */}
              <div ref={bottomRef} className="h-4" />
            </div>
          ),
        }}
      />
    </div>
  );
}
