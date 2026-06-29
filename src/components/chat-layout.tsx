"use client";

import { useEffect, useState } from "react";

import Sidebar from "./sidebar";
import ChatHeader from "./chat-header";
import EmptyChatState from "./empty-chat-state";
import ActiveChatArea from "./active-chat-area";
import AnimatedAvatar from "./animated-avatar";
import SettingsModal from "./settings-modal";
import { PomodoroProvider, usePomodoro } from "./pomodoro-context";
import { ChatMessage, DEFAULT_MODEL } from "./types";
import { ChatThread } from "./chat-types";
import { me, logout as apiLogout, AuthUser } from "./auth";
import { Play, Pause, RotateCcw } from "lucide-react";
import {
  listChats,
  createChat,
  renameChat,
  deleteChat,
  fetchChat,
  buildChatTitle,
  toggleStarChat,
} from "@/lib/chat-api";

type AvatarEmotion = "idle" | "happy" | "shy" | "caring" | "thinking";

function getInitialModel() {
  return DEFAULT_MODEL;
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



function MiniPomodoroTimer() {
  const { running, secondsLeft, mode, toggleRunning, switchMode } = usePomodoro();
  if (!running && secondsLeft === (mode === "focus" ? 25 * 60 : 5 * 60)) return null;

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timeStr = `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 glass-panel rounded-full px-4 py-2 flex items-center gap-3 animate-fade-in transition-all">
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
  const [pendingPrompt, setPendingPrompt] = useState<{ text: string; files?: File[] | null } | null>(null);
  const [avatarState, setAvatarState] = useState<{ emotion: AvatarEmotion; speaking: boolean }>({ emotion: "idle", speaking: false });

  const [chats, setChats] = useState<ChatThread[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [showAvatar, setShowAvatar] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState("chats");
  const [greeting] = useState(getTimeGreeting);



  // Setup hydration
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedModel = localStorage.getItem("kaori_model");
      if (storedModel) {
        // Use timeout to avoid synchronous setState cascading render warning
        setTimeout(() => setModel(storedModel), 0);
      }
    }
  }, []);

  // Listen for global settings changes
  useEffect(() => {
    const handleSettingsChange = () => {
      const storedModel = localStorage.getItem("kaori_model");
      if (storedModel) setModel(storedModel);
    };
    window.addEventListener("kaori_settings_changed", handleSettingsChange);
    return () => window.removeEventListener("kaori_settings_changed", handleSettingsChange);
  }, []);

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



  const activeChat = activeChatId ? chats.find((c) => c.id === activeChatId) : null;
  const isEmpty = !activeChat || activeChat.messages.length === 0;

  const updateChat = (id: string, updater: (c: ChatThread) => ChatThread) => {
    setChats((prev) => prev.map((c) => (c.id === id ? updater(c) : c)));
  };

  // ── NEW CHAT ──
  function handleNewChat() {
    if (window.innerWidth < 1024) setSidebarOpen(false);
    
    // Optimistic UI: Immediately render an empty placeholder chat
    const tempId = `temp-${Date.now()}`;
    const thread: ChatThread = {
      id: tempId,
      title: "New chat",
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    setChats((prev) => [thread, ...prev]);
    setActiveChatId(thread.id);

    // Run the actual API creation in the background
    createChat().then((newChat) => {
      // Swap the temporary local ID with the real database ID
      setChats((prev) => prev.map(c => c.id === tempId ? { ...c, id: newChat.id, title: newChat.title } : c));
      setActiveChatId((current) => current === tempId ? newChat.id : current);
    }).catch((err) => {
      console.error("Create chat error:", err);
      // Revert if the server failed
      setChats((prev) => prev.filter(c => c.id !== tempId));
      setActiveChatId((current) => current === tempId ? null : current);
    });
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

  // ── SEND INITIAL MESSAGE ──
  function handleSendInitial(text: string, files?: File[] | null) {
    if (!activeChatId || (!text && !files?.length)) return;

    if (activeChatId.startsWith("temp-")) {
      console.warn("Please wait a moment for the new chat to initialize on the server.");
      return;
    }

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

    if (activeChat && activeChat.messages.length === 0) {
      const title = buildChatTitle(text);
      handleRenameChat(activeChatId, title);
    }

    setPendingPrompt({ text, files });
  }

  return (
    <div className="h-dvh w-full flex overflow-hidden bg-[hsl(var(--background))] relative">
      <MiniPomodoroTimer />
      {/* Floating Avatar */}
      {showAvatar && (
        <div className="hidden lg:block fixed bottom-0 right-0 2xl:right-6 w-[260px] 2xl:w-[320px] h-[400px] 2xl:h-[500px] z-[25] pointer-events-none opacity-95 transition-all duration-500 will-change-transform">
          <AnimatedAvatar emotion={avatarState.emotion} speaking={avatarState.speaking} />
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
          className="relative z-10 w-full h-full flex flex-col min-w-0 min-h-0 overflow-hidden glass-panel lg:rounded-[2rem]"
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
              <EmptyChatState
                greeting={greeting}
                userName={user?.name?.split(" ")[0] || ""}
                onSend={handleSendInitial}
                model={model}
                setModel={setModel}
              />
            ) : (
              <ActiveChatArea
                activeChat={activeChat!}
                model={model}
                setModel={setModel}
                updateChat={updateChat}
                onAvatarStateChange={(emotion, speaking) => setAvatarState({ emotion, speaking })}
                pendingPrompt={pendingPrompt}
                clearPendingPrompt={() => setPendingPrompt(null)}
              />
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
