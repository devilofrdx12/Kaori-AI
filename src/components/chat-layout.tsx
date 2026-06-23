"use client";

import { useEffect, useRef, useState } from "react";
import Sidebar from "./sidebar";
import ChatHeader from "./chat-header";
import MessageArea from "./message-area";
import ChatInput from "./chat-input";
import AnimatedAvatar from "./animated-avatar";
import SettingsModal from "./settings-modal";
import { PomodoroProvider, usePomodoro } from "./pomodoro-context";
import { ChatMessage, DEFAULT_MODEL } from "./types";
import { ChatThread } from "./chat-types";
import { me, logout as apiLogout, AuthUser } from "./auth";
import { BookOpen, Code2, ListChecks, PenLine, Sparkles, Play, Pause, RotateCcw } from "lucide-react";
import {
  listChats,
  createChat,
  renameChat,
  deleteChat,
  fetchChat,
  sendMessage,
  buildChatTitle,
  toggleStarChat,
} from "@/lib/chat-api";

type AvatarEmotion = "idle" | "happy" | "shy" | "caring" | "thinking" | "surprised";

function getInitialModel() {
  if (typeof window === "undefined") return DEFAULT_MODEL;
  return localStorage.getItem("kaori_model") || DEFAULT_MODEL;
}

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function getInitialSidebarOpen() {
  if (typeof window === "undefined") return true;
  return window.innerWidth >= 1024;
}

const BLOCKED_CUSTOM_URI_PROTOCOLS = new Set([
  "about:",
  "blob:",
  "chrome:",
  "chrome-extension:",
  "data:",
  "devtools:",
  "edge:",
  "file:",
  "filesystem:",
  "http:",
  "https:",
  "javascript:",
  "vbscript:",
]);

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

function MiniPomodoroTimer() {
  const { running, secondsLeft, mode, toggleRunning, switchMode } = usePomodoro();
  if (!running && secondsLeft === (mode === "focus" ? 25 * 60 : 5 * 60)) return null;

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timeStr = `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-white dark:bg-[#222] shadow-lg border border-neutral-200 dark:border-neutral-800 rounded-full px-4 py-2 flex items-center gap-3 animate-fade-in transition-all">
      <div className="flex items-center gap-2">
        <span className="text-lg">{mode === "focus" ? "🧠" : "☕"}</span>
        <span className="font-mono font-medium text-neutral-800 dark:text-neutral-200">{timeStr}</span>
      </div>
      <div className="w-px h-4 bg-neutral-200 dark:bg-neutral-700" />
      <button onClick={toggleRunning} className="text-neutral-500 hover:text-primary transition-colors">
        {running ? <Pause size={16} /> : <Play size={16} />}
      </button>
      <button 
        onClick={() => switchMode(mode === "focus" ? "break" : "focus")} 
        className="text-neutral-500 hover:text-primary transition-colors"
        title="Skip"
      >
        <RotateCcw size={14} />
      </button>
    </div>
  );
}

function ChatLayoutInner() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(getInitialSidebarOpen);
  const [model, setModel] = useState(getInitialModel);
  const [typing, setTyping] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [toolInProgress, setToolInProgress] = useState<string | null>(null);
  const [toolResults, setToolResults] = useState<{ tool: string; result: string }[]>([]);

  const [chats, setChats] = useState<ChatThread[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [showAvatar, setShowAvatar] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState("chats");
  const [greeting] = useState(getTimeGreeting);

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
            isStarred: c.isStarred,
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
    if (window.innerWidth < 1024) setSidebarOpen(false);
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
    if (window.innerWidth < 1024) setSidebarOpen(false);

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

  // ── STAR CHAT ──
  async function handleToggleStarChat(id: string, isStarred: boolean) {
    updateChat(id, (c) => ({ ...c, isStarred }));
    try {
      await toggleStarChat(id, isStarred);
    } catch (err) {
      console.error("Star chat error:", err);
      // Revert on error
      updateChat(id, (c) => ({ ...c, isStarred: !isStarred }));
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

    const studyMode = typeof window !== "undefined" && localStorage.getItem("kaori_study_mode") === "true";

    await sendMessage({
      chatId: activeChatId,
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
      onToolStart: (tool) => {
        setToolInProgress(tool);
      },
      onToolExecuting: (tool, input) => {
        setToolInProgress(tool);
        if (tool === "open_application" && input && typeof input === "object") {
          const { uriScheme, fallbackUrl } = input as {
            uriScheme?: string;
            fallbackUrl?: string;
          };
          if (navigateToCustomUri(uriScheme)) {
            setTimeout(() => {
              openSafeHttpsUrl(fallbackUrl);
            }, 1500);
          }
        }
      },
      onToolResult: (tool, result) => {
        setToolResults((prev) => [...prev, { tool, result }]);
        setToolInProgress(null);
        if (tool === "play_spotify" && result.includes("spotify:")) {
          const match = result.match(/(spotify:[a-zA-Z0-9:]+)/);
          if (match) {
            navigateToCustomUri(match[1]);
          }
        }
        if (tool === "open_youtube" && result.includes("https://www.youtube.com")) {
          const match = result.match(/(https:\/\/www\.youtube\.com[^\s]*)/);
          if (match) {
            openSafeHttpsUrl(match[1]);
          }
        }
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
          content: `⚠️ **Error:** ${error}`,
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

  // ── EDIT & RESEND MESSAGE ──
  async function handleEditSend(messageId: string, text: string) {
    if (!activeChatId || !text) return;

    const chat = chats.find(c => c.id === activeChatId);
    if (!chat) return;

    const msgIndex = chat.messages.findIndex(m => m.id === messageId);
    if (msgIndex === -1) return;

    // Truncate messages from this point locally
    const newMessages = chat.messages.slice(0, msgIndex);
    const editedMsg: ChatMessage = {
      id: messageId, // Keep the same ID for the UI
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };
    newMessages.push(editedMsg);

    updateChat(activeChatId, (c) => ({
      ...c,
      messages: newMessages,
      updatedAt: new Date().toISOString(),
    }));

    setTyping(true);
    setStreamingText("");
    setToolInProgress(null);
    setToolResults([]);

    const controller = new AbortController();
    abortRef.current = controller;

    let fullText = "";

    const studyMode = typeof window !== "undefined" && localStorage.getItem("kaori_study_mode") === "true";

    await sendMessage({
      chatId: activeChatId,
      message: text,
      model,
      editMessageId: messageId,
      studyMode,
      signal: controller.signal,
      onText: (chunk) => {
        fullText += chunk;
        setStreamingText(fullText);
      },
      onToolStart: (tool) => {
        setToolInProgress(tool);
      },
      onToolExecuting: (tool, input) => {
        setToolInProgress(tool);
        if (tool === "open_application" && input && typeof input === "object") {
          const { uriScheme, fallbackUrl } = input as {
            uriScheme?: string;
            fallbackUrl?: string;
          };
          if (navigateToCustomUri(uriScheme)) {
            setTimeout(() => {
              openSafeHttpsUrl(fallbackUrl);
            }, 1500);
          }
        }
      },
      onToolResult: (tool, result) => {
        setToolResults((prev) => [...prev, { tool, result }]);
        setToolInProgress(null);
        if (tool === "play_spotify" && result.includes("spotify:")) {
          const match = result.match(/(spotify:[a-zA-Z0-9:]+)/);
          if (match) {
            navigateToCustomUri(match[1]);
          }
        }
        if (tool === "open_youtube" && result.includes("https://www.youtube.com")) {
          const match = result.match(/(https:\/\/www\.youtube\.com[^\s]*)/);
          if (match) {
            openSafeHttpsUrl(match[1]);
          }
        }
      },
      onDone: () => {
        const assistantMsg: ChatMessage = {
          id: `asst-${Date.now()}`,
          role: "assistant",
          content: fullText,
          timestamp: new Date().toISOString(),
        };
        updateChat(activeChatId, (c) => ({
          ...c,
          messages: [...c.messages, assistantMsg],
        }));
        setTyping(false);
        setStreamingText("");
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

  let avatarEmotion: AvatarEmotion = "idle";
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
    <div className="h-dvh w-full flex overflow-hidden bg-[hsl(var(--background))] relative">
      <MiniPomodoroTimer />
      {/* Floating Avatar */}
      {showAvatar && (
        <div className="hidden lg:block fixed bottom-0 right-0 2xl:right-6 w-[260px] 2xl:w-[320px] h-[400px] 2xl:h-[500px] z-[25] pointer-events-none opacity-95 transition-all duration-500">
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
        onToggleStarChat={handleToggleStarChat}
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((p) => !p)}
        user={user}
        onLogout={handleLogout}
        onOpenSettings={() => setShowSettings(true)}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />

      {/* Main chat area wrapper to prevent margin overflow */}
      <div className={`transition-[padding] duration-300 ease-out h-full w-full lg:py-4 lg:pr-4 ${sidebarOpen ? "lg:pl-[312px]" : "lg:pl-4"}`}>
        <main
          className="relative z-10 w-full h-full flex flex-col min-w-0 min-h-0 overflow-hidden bg-white/40 dark:bg-neutral-950/40 backdrop-blur-[40px] border border-white/40 dark:border-white/10 shadow-[0_8px_32px_hsl(220_30%_10%/0.08)] transition-[box-shadow,background-color] duration-300 ease-out lg:rounded-[2rem]"
        >
          <ChatHeader
          onToggleSidebar={() => setSidebarOpen((p) => !p)}
          sidebarOpen={sidebarOpen}
          showAvatar={showAvatar}
          onToggleAvatar={() => setShowAvatar((prev) => !prev)}
        />

        {activeTab === "chats" ? (
          <>
            {isEmpty ? (
              <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 w-full max-w-4xl mx-auto animate-fade-in pb-12 sm:pb-24">
                <div className="flex flex-col items-center text-center mb-6 sm:mb-8">
                  <div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-white/70 dark:bg-white/5 text-primary neumorphic-inset glass-border transition-transform duration-300 hover:scale-105 shadow-[0_4px_24px_-4px_hsl(var(--primary)/0.2)]">
                    <Sparkles size={24} strokeWidth={1.5} className="animate-pulse" />
                  </div>
                  <h1 className="text-2xl sm:text-4xl lg:text-5xl font-headline font-light tracking-tight text-on-surface text-balance">
                    {greeting}, {user?.name?.split(" ")[0] || "there"}
                  </h1>
                  <p className="mt-3 sm:mt-4 max-w-xl text-sm sm:text-base text-secondary font-light leading-relaxed">
                    Start a focused chat, attach an image, or choose the best model for the task.
                  </p>
                </div>
                
                <div className="w-full relative z-20">
                  <ChatInput
                    onSend={handleSend}
                    disabled={typing}
                    onStop={handleStop}
                    model={model}
                    onModelChange={setModel}
                    placeholder="How can I help you today?"
                  />
                </div>

                <div className="flex overflow-x-auto sm:flex-wrap items-center sm:justify-center gap-2.5 mt-5 w-[calc(100%+2rem)] sm:w-full max-w-3xl pb-2 px-4 sm:px-0 -mx-4 sm:mx-0 scrollbar-hide">
                  {[
                    { icon: Code2, text: "Code", prompt: "Help me write some code" },
                    { icon: Sparkles, text: "Create", prompt: "Help me create something new" },
                    { icon: BookOpen, text: "Learn", prompt: "Explain a complex topic clearly" },
                    { icon: PenLine, text: "Write", prompt: "Help me write an email or blog post" },
                    { icon: ListChecks, text: "Plan", prompt: "Help me organize my next steps" },
                  ].map((chip, i) => {
                    const Icon = chip.icon;
                    return (
                      <button
                        key={i}
                        onClick={() => handleSend(chip.prompt, null)}
                        className="shrink-0 flex h-11 items-center justify-center gap-2 rounded-[14px] bg-white/60 dark:bg-white/5 px-4 text-sm font-medium text-secondary glass-border transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-white/90 hover:-translate-y-1 hover:scale-105 hover:text-on-surface hover:shadow-md active:-translate-y-0.5 active:scale-95 group"
                      >
                        <Icon size={16} className="text-neutral-500 dark:text-neutral-400" />
                        {chip.text}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <>
                <MessageArea
                  messages={activeChat?.messages || []}
                  typing={typing}
                  toolInProgress={toolInProgress}
                  toolResults={toolResults}
                  onEditSubmit={handleEditSend}
                  streamingText={streamingText}
                  bottomRef={bottomRef}
                />

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
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center animate-fade-in p-8">
            <div className="w-16 h-16 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-6">
              {activeTab === 'projects' ? <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg> :
               activeTab === 'artifacts' ? <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg> :
               activeTab === 'code' ? <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg> : null}
            </div>
            <h2 className="text-2xl font-semibold text-neutral-800 dark:text-neutral-200 mb-2 capitalize">
              {activeTab} Workspace
            </h2>
            <p className="text-neutral-500 max-w-sm">
              This feature is scheduled for Phase 6 of the Kaori AI Godmode plan. Coming soon!
            </p>
          </div>
        )}
        </main>
      </div>
    </div>
  );
}

export default function ChatLayout() {
  return (
    <PomodoroProvider>
      <ChatLayoutInner />
    </PomodoroProvider>
  );
}
