"use client";

import { useEffect, useRef, useState } from "react";
import Sidebar from "./sidebar";
import ChatHeader from "./chat-header";
import MessageArea from "./message-area";
import ChatInput from "./chat-input";
import AnimatedAvatar from "./animated-avatar";
import { ChatMessage, DEFAULT_MODEL } from "./types";
import { ChatThread } from "./chat-types";
import { me, logout as apiLogout, AuthUser } from "./auth";
import {
  listChats,
  createChat,
  renameChat,
  deleteChat,
  fetchChat,
  sendMessage,
  buildChatTitle,
} from "@/lib/chat-api";

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

export default function ChatLayout() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [typing, setTyping] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [toolInProgress, setToolInProgress] = useState<string | null>(null);
  const [toolResults, setToolResults] = useState<{ tool: string; result: string }[]>([]);

  const [chats, setChats] = useState<ChatThread[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [showAvatar, setShowAvatar] = useState(true);

  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Init: check auth + load chats
  useEffect(() => {
    (async () => {
      try {
        const u = await me();
        setUser(u);
        if (!u) {
          window.location.href = "/login";
          return;
        }

        const data = await listChats();
        if (Array.isArray(data) && data.length) {
          const safeChats = data.map((c) => ({
            id: c.id,
            title: c.title || "New chat",
            messages: [],
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
          }));
          setChats(safeChats);
          setActiveChatId(safeChats[0].id);

          // Load first chat messages
          const full = await fetchChat(safeChats[0].id);
          setChats((prev) =>
            prev.map((c) =>
              c.id === safeChats[0].id ? { ...c, messages: full.messages || [] } : c
            )
          );
        } else {
          await handleNewChat();
        }
      } catch (err) {
        console.error("Init error:", err);
        await handleNewChat();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats, typing, streamingText]);

  const activeChat = activeChatId ? chats.find((c) => c.id === activeChatId) : null;
  const isEmpty = !activeChat || activeChat.messages.length === 0;

  const updateChat = (id: string, updater: (c: ChatThread) => ChatThread) => {
    setChats((prev) => prev.map((c) => (c.id === id ? updater(c) : c)));
  };

  // ── NEW CHAT ──
  async function handleNewChat() {
    try {
      const newChat = await createChat();
      const thread: ChatThread = {
        id: newChat.id,
        title: newChat.title,
        messages: [],
        createdAt: newChat.createdAt,
        updatedAt: newChat.updatedAt,
      };
      setChats((prev) => [thread, ...prev]);
      setActiveChatId(thread.id);
    } catch (err) {
      console.error("Create chat error:", err);
    }
  }

  // ── SELECT CHAT ──
  async function handleSelectChat(id: string) {
    setActiveChatId(id);

    const existing = chats.find((c) => c.id === id);
    if (existing && existing.messages.length > 0) return;

    try {
      const full = await fetchChat(id);
      updateChat(id, (c) => ({ ...c, messages: full.messages || [] }));
    } catch (err) {
      console.error("Load chat error:", err);
    }
  }

  // ── RENAME CHAT ──
  async function handleRenameChat(id: string, title: string) {
    updateChat(id, (c) => ({ ...c, title }));
    try {
      await renameChat(id, title);
    } catch (err) {
      console.error("Rename error:", err);
    }
  }

  // ── DELETE CHAT ──
  async function handleDeleteChat(id: string) {
    setChats((prev) => prev.filter((c) => c.id !== id));
    if (activeChatId === id) {
      const remaining = chats.filter((c) => c.id !== id);
      if (remaining.length) {
        setActiveChatId(remaining[0].id);
      } else {
        await handleNewChat();
      }
    }
    try {
      await deleteChat(id);
    } catch (err) {
      console.error("Delete error:", err);
    }
  }

  // ── LOGOUT ──
  async function handleLogout() {
    await apiLogout();
    window.location.href = "/login";
  }

  // ── SEND MESSAGE ──
  async function handleSend(text: string, files?: File[] | null) {
    if (!activeChatId || (!text && !files?.length)) return;

    // Add user message locally
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };
    updateChat(activeChatId, (c) => ({
      ...c,
      messages: [...c.messages, userMsg],
      updatedAt: new Date().toISOString(),
    }));

    // Auto-title first message
    if (activeChat && activeChat.messages.length === 0) {
      const title = buildChatTitle(text);
      handleRenameChat(activeChatId, title);
    }

    setTyping(true);
    setStreamingText("");
    setToolInProgress(null);
    setToolResults([]);

    const controller = new AbortController();
    abortRef.current = controller;

    // Convert files to data URLs
    let fileData;
    if (files?.length) {
      fileData = await Promise.all(files.map(fileToDataUrl));
    }

    let fullText = "";

    await sendMessage({
      chatId: activeChatId,
      message: text,
      model,
      files: fileData,
      signal: controller.signal,
      onText: (chunk) => {
        fullText += chunk;
        setStreamingText(fullText);
        setToolInProgress(null);
      },
      onToolStart: (tool) => {
        setToolInProgress(tool);
      },
      onToolExecuting: (tool) => {
        setToolInProgress(tool);
      },
      onToolResult: (tool, result) => {
        setToolResults((prev) => [...prev, { tool, result }]);
        setToolInProgress(null);
      },
      onDone: () => {
        // Save assistant message locally
        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: fullText,
          timestamp: new Date().toISOString(),
        };
        updateChat(activeChatId!, (c) => ({
          ...c,
          messages: [...c.messages, assistantMsg],
          updatedAt: new Date().toISOString(),
        }));
        setTyping(false);
        setStreamingText("");
        setToolInProgress(null);
        setToolResults([]);
        abortRef.current = null;
      },
      onError: (error) => {
        console.error("Chat error:", error);
        const errMsg: ChatMessage = {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: `⚠️ **Error:** ${error}\n\nPlease check your API key in \`.env\` and try again.`,
          timestamp: new Date().toISOString(),
        };
        updateChat(activeChatId!, (c) => ({
          ...c,
          messages: [...c.messages, errMsg],
        }));
        setTyping(false);
        setStreamingText("");
        setToolInProgress(null);
        abortRef.current = null;
      },
    });
  }

  // ── STOP ──
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
        updateChat(activeChatId!, (c) => ({
          ...c,
          messages: [...c.messages, msg],
        }));
      }
      setStreamingText("");
      setToolInProgress(null);
    }
  }

  let avatarEmotion: any = "idle";
  let avatarSpeaking = false;

  if (toolInProgress) {
    avatarEmotion = "shy";
  } else if (typing && !streamingText) {
    avatarEmotion = "thinking";
  } else if (typing && streamingText) {
    avatarEmotion = "happy";
    avatarSpeaking = true;
  }

  return (
    <div className="h-screen flex overflow-hidden bg-[hsl(var(--background))]">
      {/* Floating Avatar */}
      {showAvatar && (
        <div className="fixed bottom-0 right-[-30px] sm:right-[-50px] w-[280px] h-[450px] sm:w-[350px] sm:h-[550px] z-50 pointer-events-none drop-shadow-2xl">
          <AnimatedAvatar emotion={avatarEmotion} speaking={avatarSpeaking} />
        </div>
      )}

      {/* Sidebar */}
      <Sidebar
        chats={chats}
        activeChatId={activeChatId || ""}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
        onRenameChat={handleRenameChat}
        onDeleteChat={handleDeleteChat}
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((p) => !p)}
        user={user}
        onLogout={handleLogout}
      />

      {/* Main chat area */}
      <main
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
          sidebarOpen ? "lg:ml-72" : "ml-0"
        }`}
      >
        <ChatHeader
          onToggleSidebar={() => setSidebarOpen((p) => !p)}
          sidebarOpen={sidebarOpen}
        />
        
        {/* Toggle Avatar Button */}
        <button
          onClick={() => setShowAvatar((prev) => !prev)}
          className="absolute top-4 right-16 md:right-24 z-50 flex items-center justify-center p-2 rounded-lg text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 bg-white/50 dark:bg-[#1a1a1a]/50 hover:bg-white dark:hover:bg-[#2a2a2a] backdrop-blur-md border border-neutral-200/50 dark:border-neutral-800/50 transition-all shadow-sm"
          title={showAvatar ? "Hide Kaori" : "Show Kaori"}
        >
          {showAvatar ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          )}
        </button>

        {isEmpty ? (
          <div className="flex-1 flex flex-col items-center justify-center px-4 w-full max-w-4xl mx-auto animate-fade-in -mt-16">
            {/* Greeting */}
            <div className="flex items-center gap-3 mb-8">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-[#d96b41]">
                <path d="M12 2v20m10-10H2m17.071-7.071L4.93 19.07M19.071 19.071L4.93 4.93" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <h1 className="text-4xl sm:text-5xl font-serif text-neutral-800 dark:text-neutral-200">
                Good evening, {user?.name?.toLowerCase() || "hari karthick"}
              </h1>
            </div>
            
            {/* Chat Input */}
            <div className="w-full">
              <ChatInput
                onSend={handleSend}
                disabled={typing}
                onStop={handleStop}
                model={model}
                onModelChange={setModel}
                placeholder="How can I help you today?"
              />
            </div>

            {/* Suggestion Chips */}
            <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
              {[
                { icon: "</>", text: "Code" },
                { icon: "🏷️", text: "Create" },
                { icon: "🎓", text: "Learn" },
                { icon: "✏️", text: "Write" },
                { icon: "☕", text: "Life stuff" },
              ].map((chip, i) => (
                <button
                  key={i}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#333333] hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors text-sm font-medium text-neutral-700 dark:text-neutral-300"
                >
                  <span className="text-neutral-500 dark:text-neutral-400 font-mono">{chip.icon}</span>
                  {chip.text}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <MessageArea
              messages={activeChat?.messages || []}
              typing={typing}
              toolInProgress={toolInProgress}
              toolResults={toolResults}
              streamingText={streamingText}
            />

            <div ref={bottomRef} />

            <ChatInput
              onSend={handleSend}
              disabled={typing}
              onStop={handleStop}
              model={model}
              onModelChange={setModel}
              placeholder="Reply to Kaori"
            />
          </>
        )}
      </main>
    </div>
  );
}
