import { X, Palette, Cpu, Link as LinkIcon, Activity, Database, LogOut, Timer, Shield, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { motion, useDragControls } from "framer-motion";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { listChats, fetchChat } from "../lib/chat-api";
import PomodoroTimer from "./pomodoro-timer";
import SessionManager from "./session-manager";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

type Tab = "appearance" | "model" | "accounts" | "usage" | "focus" | "sessions" | "data";

type UsageData = {
  messagesToday: number;
  dailySpendUsd: number;
  dailyLimitUsd: number;
  toolsUsed: number;
  isPro: boolean;
  messageLimit: number | null;
};

const AJAX_HEADERS: HeadersInit = {
  "X-Requested-With": "XMLHttpRequest",
};

function getStoredValue(key: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  return localStorage.getItem(key) || fallback;
}

function applyTheme(t: string) {
  const root = document.documentElement;
  if (t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

function applyAccent(colorName: string) {
  const root = document.documentElement;
  const colors: Record<string, string> = {
    blue: "217 91% 60%",
    purple: "270 95% 60%",
    pink: "330 81% 60%",
    green: "142 71% 45%",
    orange: "18 65% 59%",
    indigo: "239 84% 67%",
    black: "0 0% 10%",
  };
  const hsl = colors[colorName] || colors.orange;
  root.style.setProperty("--primary", hsl);
  root.style.setProperty("--ring", hsl);
}

function applyFont(f: string) {
  if (f === "Kaori UI") {
    document.documentElement.style.setProperty("--font-sans", `"Poppins", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`);
    document.documentElement.style.setProperty("--font-assistant", `"Lora", "Playfair Display", Georgia, serif`);
  } else {
    document.documentElement.style.setProperty("--font-sans", `"${f}", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`);
    document.documentElement.style.removeProperty("--font-assistant");
  }
}

export default function SettingsModal({ isOpen, onClose }: Props) {
  const dragControls = useDragControls();
  const [activeTab, setActiveTab] = useState<Tab>("appearance");
  const [statusMsg, setStatusMsg] = useState("");
  const [theme, setTheme] = useState(() => getStoredValue("kaori_theme", "system"));
  const [accent, setAccent] = useState(() => getStoredValue("kaori_accent", "orange"));
  const [font, setFont] = useState(() => getStoredValue("kaori_font", "Kaori UI"));
  const [provider, setProvider] = useState(() => getStoredValue("kaori_provider", "google"));
  const [model, setModel] = useState(() => getStoredValue("kaori_model", "gemini-2.5-flash"));
  const [studyMode, setStudyMode] = useState(() => getStoredValue("kaori_study_mode", "false") === "true");
  const [isPro, setIsPro] = useState(false);
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      fetch("/api/user/pro", { headers: AJAX_HEADERS })
        .then((r) => r.json())
        .then((data) => {
          if (!cancelled && data && typeof data.is_pro === "boolean") {
            setIsPro(data.is_pro);
          }
        })
        .catch(console.error);

      setUsageLoading(true);
      fetch("/api/user/usage", { headers: AJAX_HEADERS })
        .then((r) => r.json())
        .then((data) => {
          if (!cancelled && data && typeof data.messagesToday === "number") {
            setUsageData(data);
            setIsPro(data.isPro);
          }
        })
        .catch(console.error)
        .finally(() => {
          if (!cancelled) setUsageLoading(false);
        });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [isOpen]);

  useEffect(() => {
    applyTheme(theme);
    applyAccent(accent);
    applyFont(font);
  }, [accent, font, theme]);

  const handleFontChange = (newFont: string) => {
    setFont(newFont);
    localStorage.setItem("kaori_font", newFont);
    applyFont(newFont);
  };

  const handleAccentChange = (colorName: string) => {
    setAccent(colorName);
    localStorage.setItem("kaori_accent", colorName);
    applyAccent(colorName);
  };

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    localStorage.setItem("kaori_theme", newTheme);
    applyTheme(newTheme);
  };

  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    localStorage.setItem("kaori_provider", newProvider);
    const defaultModel = newProvider === "google" ? "gemini-2.5-flash" : "llama-3.3-70b-versatile";
    setModel(defaultModel);
    localStorage.setItem("kaori_model", defaultModel);
  };

  const handleModelChange = (newModel: string) => {
    setModel(newModel);
    localStorage.setItem("kaori_model", newModel);
  };

  const toggleStudyMode = () => {
    const val = !studyMode;
    setStudyMode(val);
    localStorage.setItem("kaori_study_mode", String(val));
  };

  const handleExportData = async () => {
    try {
      setStatusMsg("Exporting data... please wait.");
      const chats = await listChats();
      const zip = new JSZip();
      const chatFolder = zip.folder("kaori_chats");

      for (const chat of chats) {
        const fullChat = await fetchChat(chat.id);
        let mdContent = `# ${chat.title}\n\n`;
        for (const msg of fullChat.messages) {
          mdContent += `**${msg.role === 'user' ? 'You' : 'Kaori'}**:\n${msg.content}\n\n---\n\n`;
        }
        chatFolder?.file(`${chat.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${chat.id.substring(0, 8)}.md`, mdContent);
      }

      const blob = await zip.generateAsync({ type: "blob" });
      saveAs(blob, "kaori_chats_export.zip");
      setStatusMsg("Export successful!");
    } catch (e: unknown) {
      setStatusMsg(`Error exporting data: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  };

  const handleDeleteAllChats = async () => {
    if (!confirm("Are you absolutely sure you want to delete ALL conversations? This cannot be undone.")) return;
    try {
      const res = await fetch("/api/chats", {
        method: "DELETE",
        headers: AJAX_HEADERS,
      });
      if (res.ok) {
        setStatusMsg("Success: All chats deleted. Please refresh the page.");
      } else {
        setStatusMsg("Error deleting chats.");
      }
    } catch (e: unknown) {
      setStatusMsg(`Error deleting chats: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get("success");
    const error = urlParams.get("error");

    // Sanitise: only allow known safe messages from OAuth callbacks
    const SAFE_SUCCESS: Record<string, string> = {
      google_connected: "Google account connected successfully.",
      spotify_connected: "Spotify account connected successfully.",
    };
    const SAFE_ERROR: Record<string, string> = {
      google_failed: "Failed to connect Google account.",
      spotify_failed: "Failed to connect Spotify account.",
      oauth_cancelled: "OAuth flow was cancelled.",
    };

    let message = "";
    if (success && SAFE_SUCCESS[success]) {
      message = `Success: ${SAFE_SUCCESS[success]}`;
    } else if (error && SAFE_ERROR[error]) {
      message = `Error: ${SAFE_ERROR[error]}`;
    } else if (success) {
      message = "Success: Operation completed.";
    } else if (error) {
      message = "Error: Something went wrong.";
    }
    if (!message) return;

    const timeoutId = window.setTimeout(() => {
      setStatusMsg(message);
      setActiveTab("accounts");
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [isOpen]);

  if (!isOpen) return null;

  const tabs = [
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "model", label: "AI Model", icon: Cpu },
    { id: "accounts", label: "Connected Accounts", icon: LinkIcon },
    { id: "usage", label: "Usage", icon: Activity },
    { id: "focus", label: "Focus Mode", icon: Timer },
    { id: "sessions", label: "Sessions", icon: Shield },
    { id: "data", label: "Data & Privacy", icon: Database },
  ] as const;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-[1px] p-4 pointer-events-none">
      <motion.div 
        drag 
        dragControls={dragControls}
        dragListener={false}
        dragMomentum={false}
        dragElastic={0}
        className="relative w-full max-w-4xl h-[90vh] md:h-[80vh] flex flex-col md:flex-row bg-[#fafafa] dark:bg-[#111111] rounded-2xl shadow-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 pointer-events-auto"
      >
        {/* Full-width Drag Handle */}
        <div 
          className="absolute top-0 left-0 right-0 h-10 z-50 cursor-grab active:cursor-grabbing"
          onPointerDown={(e) => dragControls.start(e)}
        />
        
        {/* Sidebar */}
        <div className="w-full md:w-64 shrink-0 bg-white dark:bg-[#1c1c1c] border-b md:border-b-0 md:border-r border-neutral-200 dark:border-neutral-800 flex flex-col pt-10">
          <div className="px-6 pb-4 md:pb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 select-none">Settings</h2>
          </div>
          <nav className="flex-none md:flex-1 px-3 space-x-2 md:space-x-0 md:space-y-1 flex md:flex-col overflow-x-auto pb-4 md:pb-0 scrollbar-hide">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as Tab)}
                  className={`shrink-0 md:w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive 
                      ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100" 
                      : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 hover:text-neutral-900 dark:hover:text-neutral-200"
                  }`}
                >
                  <Icon size={18} className={isActive ? "text-primary" : ""} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
          
          <div className="hidden md:block p-4 border-t border-neutral-200 dark:border-neutral-800">
            <button 
              onClick={async () => {
                await fetch('/api/auth/logout', { method: 'POST', headers: AJAX_HEADERS });
                window.location.href = '/login';
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
            >
              <LogOut size={18} />
              Logout
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col relative bg-[#fafafa] dark:bg-[#111111]">
          <button 
            onClick={onClose} 
            style={{ zIndex: 60 }}

            className="absolute top-6 right-6 p-2 rounded-full text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
          >
            <X size={20} />
          </button>

          <div className="flex-1 overflow-y-auto p-6 md:p-10">
            <div className="max-w-2xl mx-auto space-y-8">
              
              {statusMsg && (
                <div className={`p-4 rounded-xl text-sm border ${statusMsg.startsWith("Error") ? "bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-900/50 dark:text-red-400" : "bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-900/50 dark:text-green-400"}`}>
                  {statusMsg}
                </div>
              )}

              {/* APPEARANCE */}
              {activeTab === "appearance" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <h3 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Appearance</h3>
                  <p className="text-neutral-500 dark:text-neutral-400 text-sm">Customize how Kaori looks and feels.</p>
                  
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-white dark:bg-[#1c1c1c] border border-neutral-200 dark:border-neutral-800">
                      <div className="font-medium text-neutral-900 dark:text-neutral-100 mb-4">Theme</div>
                      <div className="flex gap-3">
                        {["Light", "Dark", "System"].map(t => {
                          const isSelected = theme === t.toLowerCase();
                          return (
                            <button 
                              key={t} 
                              onClick={() => handleThemeChange(t.toLowerCase())}
                              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${isSelected ? 'border-primary text-primary bg-primary/10' : 'border-neutral-200 dark:border-neutral-700 hover:border-primary'}`}
                            >
                              {t}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-white dark:bg-[#1c1c1c] border border-neutral-200 dark:border-neutral-800">
                      <div className="font-medium text-neutral-900 dark:text-neutral-100 mb-4">Accent Color</div>
                      <div className="flex gap-3">
                        {[
                          { id: "blue", bg: "bg-blue-500" },
                          { id: "purple", bg: "bg-purple-500" },
                          { id: "pink", bg: "bg-pink-500" },
                          { id: "green", bg: "bg-green-500" },
                          { id: "orange", bg: "bg-orange-500" },
                          { id: "indigo", bg: "bg-indigo-400" },
                          { id: "black", bg: "bg-zinc-900 dark:bg-white" }
                        ].map(c => (
                          <button 
                            key={c.id} 
                            onClick={() => handleAccentChange(c.id)}
                            className={`w-8 h-8 rounded-full ${c.bg} ring-2 transition-all ${accent === c.id ? 'ring-primary ring-offset-2 dark:ring-offset-[#111111]' : 'ring-transparent hover:ring-neutral-400'}`}>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-white dark:bg-[#1c1c1c] border border-neutral-200 dark:border-neutral-800">
                      <div className="font-medium text-neutral-900 dark:text-neutral-100 mb-4">Font Family</div>
                      <div className="flex flex-wrap gap-3">
                        {["Inter", "Roboto", "Outfit", "Playfair Display", "Kaori UI"].map(f => {
                          const isSelected = font === f;
                          const familyStyle = f === "Kaori UI" ? '"Poppins", "Inter", sans-serif' : `"${f}", sans-serif`;
                          return (
                            <button 
                              key={f} 
                              onClick={() => handleFontChange(f)}
                              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${isSelected ? 'border-primary text-primary bg-primary/10' : 'border-neutral-200 dark:border-neutral-700 hover:border-primary'}`}
                              style={{ fontFamily: familyStyle }}
                            >
                              {f}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* AI MODEL */}
              {activeTab === "model" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <h3 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">AI Model</h3>
                  <p className="text-neutral-500 dark:text-neutral-400 text-sm">Configure default providers and advanced capabilities.</p>
                  
                  <div className="space-y-4">
                    <div className="p-5 rounded-2xl bg-white dark:bg-[#1c1c1c] border border-neutral-200 dark:border-neutral-800 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Default Provider</label>
                        <select 
                          value={provider}
                          onChange={(e) => handleProviderChange(e.target.value)}
                          className="w-full bg-neutral-50 dark:bg-[#111111] border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 outline-none focus:ring-2 focus:ring-primary/50"
                        >
                          <option value="google">Google</option>
                          <option value="groq">Groq</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Default Model</label>
                        <select 
                          value={model}
                          onChange={(e) => handleModelChange(e.target.value)}
                          className="w-full bg-neutral-50 dark:bg-[#111111] border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 outline-none focus:ring-2 focus:ring-primary/50"
                        >
                          {provider === "google" && <option value="gemini-2.5-flash">gemini-2.5-flash</option>}
                          {provider === "groq" && (
                            <>
                              <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile</option>
                              <option value="mixtral-8x7b-32768">mixtral-8x7b-32768</option>
                            </>
                          )}
                        </select>
                      </div>
                    </div>

                    <div className="p-5 rounded-2xl bg-white dark:bg-[#1c1c1c] border border-neutral-200 dark:border-neutral-800 space-y-4">
                      {/* Extended thinking removed since we aren't using Opus */}
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-neutral-900 dark:text-neutral-100">Study Mode</div>
                          <div className="text-sm text-neutral-500">Provide hints instead of direct answers.</div>
                        </div>
                        <div 
                          onClick={toggleStudyMode}
                          className={`w-10 h-6 rounded-full relative cursor-pointer transition-colors ${studyMode ? 'bg-primary' : 'bg-neutral-200 dark:bg-neutral-700'}`}
                        >
                          <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${studyMode ? 'right-1' : 'left-1'}`}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* CONNECTED ACCOUNTS */}
              {activeTab === "accounts" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <h3 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Connected Accounts</h3>
                  <p className="text-neutral-500 dark:text-neutral-400 text-sm">Allow Kaori to perform actions on your behalf.</p>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-5 rounded-2xl bg-white dark:bg-[#1c1c1c] border border-neutral-200 dark:border-neutral-800">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-500">
                          G
                        </div>
                        <div>
                          <div className="font-medium text-neutral-900 dark:text-neutral-100">Google</div>
                          <div className="text-sm text-neutral-500">Drive & Gmail access</div>
                        </div>
                      </div>
                      <a href="/api/auth/google" className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors">
                        Connect
                      </a>
                    </div>

                    <div className="flex items-center justify-between p-5 rounded-2xl bg-white dark:bg-[#1c1c1c] border border-neutral-200 dark:border-neutral-800">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center text-green-500">
                          S
                        </div>
                        <div>
                          <div className="font-medium text-neutral-900 dark:text-neutral-100">Spotify</div>
                          <div className="text-sm text-neutral-500">Playback control</div>
                        </div>
                      </div>
                      <a href="/api/auth/spotify" className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-white dark:text-neutral-900 text-white rounded-lg text-sm font-medium transition-colors">
                        Connect
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* USAGE */}
              {activeTab === "usage" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <h3 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Usage & Limits</h3>
                  <p className="text-neutral-500 dark:text-neutral-400 text-sm">Monitor your API spend and limits.</p>
                  
                  {usageLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 size={20} className="animate-spin text-neutral-400" />
                      <span className="ml-2 text-sm text-neutral-500">Loading usage data...</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-5 rounded-2xl bg-white dark:bg-[#1c1c1c] border border-neutral-200 dark:border-neutral-800">
                        <div className="text-sm text-neutral-500 mb-1">Messages Today</div>
                        <div className="text-3xl font-semibold text-neutral-900 dark:text-neutral-100">
                          {usageData?.messagesToday ?? 0} {isPro ? <span className="text-sm text-green-500 dark:text-green-400 ml-2 font-medium bg-green-500/10 px-2 py-0.5 rounded-md uppercase tracking-wider text-[10px]">Unlimited</span> : <span className="text-lg text-neutral-400">/ {usageData?.messageLimit ?? 100}</span>}
                        </div>
                      </div>
                      <div className="p-5 rounded-2xl bg-white dark:bg-[#1c1c1c] border border-neutral-200 dark:border-neutral-800">
                        <div className="text-sm text-neutral-500 mb-1">Daily Spend</div>
                        <div className="text-3xl font-semibold text-neutral-900 dark:text-neutral-100">
                          ${(usageData?.dailySpendUsd ?? 0).toFixed(2)} {isPro ? <span className="text-sm text-green-500 dark:text-green-400 ml-2 font-medium bg-green-500/10 px-2 py-0.5 rounded-md uppercase tracking-wider text-[10px]">Unlimited</span> : <span className="text-lg text-neutral-400">/ ${(usageData?.dailyLimitUsd ?? 2).toFixed(2)}</span>}
                        </div>
                      </div>
                      <div className="p-5 rounded-2xl bg-white dark:bg-[#1c1c1c] border border-neutral-200 dark:border-neutral-800">
                        <div className="text-sm text-neutral-500 mb-1">Tools Used</div>
                        <div className="text-3xl font-semibold text-neutral-900 dark:text-neutral-100">{usageData?.toolsUsed ?? 0}</div>
                      </div>
                      <div className="p-5 rounded-2xl bg-white dark:bg-[#1c1c1c] border border-neutral-200 dark:border-neutral-800">
                        <div className="text-sm text-neutral-500 mb-1">Est. Session Cost</div>
                        <div className="text-3xl font-semibold text-neutral-900 dark:text-neutral-100">${(usageData?.dailySpendUsd ?? 0).toFixed(4)}</div>
                      </div>
                    </div>
                  )}

                  <div className="mt-6 p-5 rounded-2xl bg-white dark:bg-[#1c1c1c] border border-neutral-200 dark:border-neutral-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                          Kaori Pro 
                          <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                            {isPro ? "ACTIVE" : "FREE TIER"}
                          </span>
                        </div>
                        <div className="text-sm text-neutral-500">{isPro ? "Unlimited messages and priority access." : "Upgrade for unlimited messages and premium features."}</div>
                      </div>
                      {!isPro && (
                        <button 
                          className="px-4 py-2 bg-[hsl(var(--primary))] hover:brightness-110 text-white rounded-lg text-sm font-medium transition-colors cursor-not-allowed opacity-60"
                          title="Coming soon"
                          disabled
                        >
                          Upgrade
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* FOCUS MODE */}
              {activeTab === "focus" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <h3 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Focus Mode</h3>
                  <p className="text-neutral-500 dark:text-neutral-400 text-sm">Stay productive with the Pomodoro technique.</p>
                  
                  <div className="p-6 rounded-2xl bg-white dark:bg-[#1c1c1c] border border-neutral-200 dark:border-neutral-800">
                    <PomodoroTimer />
                  </div>
                </div>
              )}

              {/* SESSIONS */}
              {activeTab === "sessions" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <h3 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Active Sessions</h3>
                  <p className="text-neutral-500 dark:text-neutral-400 text-sm">Manage devices signed into your account.</p>
                  
                  <SessionManager />
                </div>
              )}

              {/* DATA */}
              {activeTab === "data" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <h3 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Data & Privacy</h3>
                  <p className="text-neutral-500 dark:text-neutral-400 text-sm">Manage your personal data and account.</p>
                  
                  <div className="space-y-4">
                    <div className="p-5 rounded-2xl bg-white dark:bg-[#1c1c1c] border border-neutral-200 dark:border-neutral-800 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-neutral-900 dark:text-neutral-100">Export Conversations</div>
                          <div className="text-sm text-neutral-500">Download all your chats as Markdown.</div>
                        </div>
                        <button onClick={handleExportData} className="px-4 py-2 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-lg text-sm font-medium transition-colors">
                          Export ZIP
                        </button>
                      </div>
                      <hr className="border-neutral-100 dark:border-neutral-800" />
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-neutral-900 dark:text-neutral-100">Export My Data (GDPR)</div>
                          <div className="text-sm text-neutral-500">Request a full export of your profile and data.</div>
                        </div>
                        <button className="px-4 py-2 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-lg text-sm font-medium transition-colors">
                          Request Data
                        </button>
                      </div>
                    </div>

                    <div className="p-5 rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-red-600 dark:text-red-400">Delete All Conversations</div>
                          <div className="text-sm text-red-500/80">This action cannot be undone.</div>
                        </div>
                        <button onClick={handleDeleteAllChats} className="px-4 py-2 bg-red-100 hover:bg-red-200 dark:bg-red-900/40 dark:hover:bg-red-900/60 text-red-700 dark:text-red-300 rounded-lg text-sm font-medium transition-colors">
                          Delete Chats
                        </button>
                      </div>
                      <hr className="border-red-200 dark:border-red-900/50" />
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-red-600 dark:text-red-400">Delete Account</div>
                          <div className="text-sm text-red-500/80">Permanently remove your account and data.</div>
                        </div>
                        <button className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors">
                          Delete Account
                        </button>
                      </div>
                      <hr className="border-red-200 dark:border-red-900/50" />
                      <div className="flex items-center justify-between md:hidden">
                        <div>
                          <div className="font-medium text-red-600 dark:text-red-400">Logout</div>
                          <div className="text-sm text-red-500/80">Sign out of your account on this device.</div>
                        </div>
                        <button 
                          onClick={async () => {
                            await fetch('/api/auth/logout', { method: 'POST', headers: AJAX_HEADERS });
                            window.location.href = '/login';
                          }} 
                          className="px-4 py-2 bg-red-100 hover:bg-red-200 dark:bg-red-900/40 dark:hover:bg-red-900/60 text-red-700 dark:text-red-300 rounded-lg text-sm font-medium transition-colors"
                        >
                          Logout
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
