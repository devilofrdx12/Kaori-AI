"use client";

import { X, Palette, Cpu, Link as LinkIcon, Activity, Database, LogOut, Timer, Shield, Loader2, ChevronDown, Info } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { motion, useDragControls, AnimatePresence } from "framer-motion";import JSZip from "jszip";
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
    teal: "173 80% 40%",
    orange: "18 65% 59%",
    indigo: "239 84% 67%",
    black: "0 0% 10%",
  };
  const hsl = colors[colorName] || colors.orange;
  root.style.setProperty("--primary", hsl);
  root.style.setProperty("--ring", hsl);
  root.style.setProperty("--color-primary", `hsl(${hsl})`);

  const h = hsl.split(" ")[0];
  root.style.setProperty("--theme-h", h);
  if (colorName === "black") {
    root.style.setProperty("--theme-s-light", "0%");
    root.style.setProperty("--theme-s-dark", "0%");
  } else {
    root.style.setProperty("--theme-s-light", "20%");
    root.style.setProperty("--theme-s-dark", "20%");
  }
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

function CustomSelect({
  value,
  onChange,
  options,
  label,
  size = "md",
}: {
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  label?: string;
  size?: "md" | "lg";
}) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((o) => o.value === value) || options[0];

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    // Timeout prevents the click that opens the menu from instantly closing it
    setTimeout(() => window.addEventListener("click", handleClickOutside), 10);
    return () => window.removeEventListener("click", handleClickOutside);
  }, [open]);

  const sizeClasses = size === "lg" 
    ? "rounded-2xl px-6 py-4 font-light bg-white/25 dark:bg-white/[0.04] text-base" 
    : "rounded-xl px-3 py-2.5 text-sm bg-white/45 dark:bg-neutral-950/45 font-medium";

  return (
    <div className={`relative ${open ? "z-50" : "z-10"}`} ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className={`settings-glass-card flex w-full items-center justify-between border border-white/45 text-neutral-900 outline-none backdrop-blur-xl focus:ring-2 focus:ring-[hsl(var(--primary)/0.25)] dark:border-white/10 dark:text-neutral-100 hover:bg-white/60 dark:hover:bg-white/10 hover-lift active-press ${sizeClasses}`}
        type="button"
        aria-label={label}
      >
        <span>{selectedOption?.label}</span>
        <ChevronDown className="w-4 h-4 text-neutral-500 transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ ease: [0.34, 1.56, 0.64, 1], duration: 0.4 }}
            className="absolute left-0 right-0 top-full mt-2 overflow-hidden rounded-2xl border border-white/40 bg-white/85 p-1.5 shadow-[0_16px_48px_-12px_hsl(var(--primary)/0.25)] backdrop-blur-2xl origin-top dark:border-white/10 dark:bg-neutral-900/90"
          >
            <div className="max-h-60 overflow-y-auto scrollbar-hide flex flex-col gap-0.5">
              {options.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center px-4 py-2.5 text-sm rounded-xl ${
                    value === opt.value
                      ? "bg-white/60 text-neutral-900 shadow-sm dark:bg-white/15 dark:text-neutral-100 font-medium"
                      : "text-neutral-600 hover:bg-white/30 dark:text-neutral-400 dark:hover:bg-white/10 font-light"
                  } hover-lift active-press`}
                  type="button"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function SettingsModal({ isOpen, onClose }: Props) {
  const dragControls = useDragControls();
  const [activeTab, setActiveTab] = useState<Tab>("appearance");
  const [statusMsg, setStatusMsg] = useState("");
  const [isMobile, setIsMobile] = useState(false);
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
    if (typeof window !== "undefined") {
      const handleResize = () => setIsMobile(window.innerWidth < 768);
      handleResize();
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  }, []);

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
    window.dispatchEvent(new Event("kaori_settings_changed"));
  };

  const handleModelChange = (newModel: string) => {
    setModel(newModel);
    localStorage.setItem("kaori_model", newModel);
    window.dispatchEvent(new Event("kaori_settings_changed"));
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

  const handleRequestGDPRData = async () => {
    try {
      setStatusMsg("Preparing your GDPR data export... please wait.");
      const chats = await listChats();
      const zip = new JSZip();
      const chatFolder = zip.folder("kaori_gdpr_export");

      // Export all chats
      for (const chat of chats) {
        const fullChat = await fetchChat(chat.id);
        let mdContent = `# ${chat.title}\n\n`;
        for (const msg of fullChat.messages) {
          mdContent += `**${msg.role === 'user' ? 'You' : 'Kaori'}**:\n${msg.content}\n\n---\n\n`;
        }
        chatFolder?.file(`${chat.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${chat.id.substring(0, 8)}.md`, mdContent);
      }

      // Export settings
      const settings: Record<string, string | null> = {};
      ['kaori_theme', 'kaori_accent', 'kaori_font', 'kaori_provider', 'kaori_model', 'kaori_study_mode'].forEach(key => {
        settings[key] = localStorage.getItem(key);
      });
      chatFolder?.file('settings.json', JSON.stringify(settings, null, 2));

      const blob = await zip.generateAsync({ type: "blob" });
      saveAs(blob, "kaori_gdpr_data_export.zip");
      setStatusMsg("Success: Your GDPR data export has been downloaded.");
    } catch (e: unknown) {
      setStatusMsg(`Error exporting data: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm("Are you sure you want to permanently delete your account? All your data, conversations, and settings will be lost forever.")) return;
    if (!confirm("This is your FINAL confirmation. Type OK in the next dialog will not appear — clicking OK here will permanently delete everything. Proceed?")) return;

    try {
      setStatusMsg("Deleting your account data...");

      // Delete all chats
      await fetch("/api/chats", {
        method: "DELETE",
        headers: AJAX_HEADERS,
      });

      // Logout (destroys session)
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: AJAX_HEADERS,
      });

      // Clear all local storage
      localStorage.clear();

      window.location.href = '/login';
    } catch (e: unknown) {
      setStatusMsg(`Error deleting account: ${e instanceof Error ? e.message : "Unknown error"}`);
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
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 md:p-6">
          {/* Clickable backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="settings-glass-backdrop absolute inset-0 bg-black/20" 
            onClick={onClose} 
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ ease: [0.34, 1.56, 0.64, 1], duration: 0.5 }}
            style={{ willChange: "transform, opacity" }}
            drag={!isMobile}
            dragControls={dragControls}
            dragListener={false}
            dragMomentum={false}
            dragElastic={0}
            className="settings-glass-shell relative flex h-[calc(100dvh-2rem)] max-h-[800px] w-full min-w-0 max-w-4xl flex-row overflow-hidden rounded-[1.75rem] sm:rounded-[2.25rem] pointer-events-auto md:h-[min(80dvh,800px)]"
          >
        {/* Close Button Pinned to Modal Top Right */}
        <button 
          onClick={onClose} 
          aria-label="Close settings"
          className="settings-glass-card absolute right-3 top-3 z-[60] rounded-full border border-white/40 bg-white/30 p-2 shadow-sm backdrop-blur-xl hover-lift active-press hover:bg-white/45 dark:border-white/10 dark:bg-white/10 dark:hover:bg-white/15 sm:right-4 sm:top-4"
        >
          <X size={24} className="text-neutral-900 dark:text-neutral-100" />
        </button>

        {/* Full-width Drag Handle */}
        <div 
          className="absolute left-3 right-16 top-0 z-50 h-11 cursor-grab active:cursor-grabbing sm:left-5"
          onPointerDown={(e) => dragControls.start(e)}
        />
        
        {/* Sidebar */}
        <div className="flex w-16 md:w-72 shrink-0 flex-col border-r border-white/45 bg-white/35 px-2 pb-4 pt-12 md:pt-8 backdrop-blur-[18px] backdrop-saturate-150 dark:border-white/10 dark:bg-neutral-900/40 md:px-5 md:h-full md:pb-8">
          <div className="flex min-w-0 flex-col px-2 pb-4 md:mb-8 items-center md:items-start">
            <h2 className="text-xl md:text-2xl font-light tracking-tighter text-neutral-900 dark:text-neutral-100 select-none hidden md:block">Settings</h2>
            <p className="text-xs text-neutral-500 mt-1 uppercase tracking-widest font-medium hidden md:block">Manage your AI environment</p>
          </div>
          <nav className="flex w-full min-w-0 flex-none flex-col gap-2 md:gap-1 overflow-y-auto pb-0 scrollbar-hide">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as Tab)}
                  title={tab.label}
                  className={`group flex h-11 shrink-0 items-center justify-center md:justify-start gap-3 rounded-[1.25rem] px-0 md:px-4 text-sm md:h-auto md:w-full md:py-3 active-press hover-lift ${
                    isActive 
                      ? "bg-white/60 text-neutral-900 shadow-sm dark:bg-white/10 dark:text-neutral-100 border border-white/40 dark:border-white/10 font-medium" 
                      : "text-neutral-600 hover:bg-white/45 font-light tracking-tight dark:text-neutral-400 dark:hover:bg-white/10 border border-transparent"
                  }`}
                >
                  <Icon size={18} className={`${isActive ? "text-primary" : "text-neutral-500 dark:text-neutral-400"} group-hover:scale-110 transition-transform duration-500`} />
                  <span className="whitespace-nowrap hidden md:block">{tab.label}</span>
                </button>
              );
            })}
          </nav>
          
          <div className="mt-4 hidden border-t border-white/35 p-4 dark:border-white/10 md:block">
            <button 
              onClick={async () => {
                await fetch('/api/auth/logout', { method: 'POST', headers: AJAX_HEADERS });
                window.location.href = '/login';
              }}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-red-600 hover-lift active-press hover:bg-red-50/70 dark:text-red-400 dark:hover:bg-red-500/10"
            >
              <LogOut size={18} />
              Logout
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-transparent">
          <header className="settings-glass-pane z-20 flex shrink-0 items-center justify-between border-b border-white/35 bg-white/20 px-5 py-4 backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.03] sm:px-8 md:px-10 md:py-6">
            <h2 className="min-w-0 truncate pr-12 text-2xl font-light tracking-tight text-neutral-900 dark:text-neutral-100 md:text-3xl">{tabs.find(t => t.id === activeTab)?.label}</h2>
          </header>

          <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden p-4 sm:p-6 md:p-10 relative pb-[30vh]">
            <div className="mx-auto max-w-2xl space-y-8 pb-12">
              
              {statusMsg && (
                <div className={`p-4 rounded-xl text-sm border ${statusMsg.startsWith("Error") ? "bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-900/50 dark:text-red-400" : "bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-900/50 dark:text-green-400"}`}>
                  {statusMsg}
                </div>
              )}

              {/* APPEARANCE */}
              {activeTab === "appearance" && (
                <div className="space-y-12 animate-in fade-in zoom-in duration-500">
                  {/* Theme */}
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-semibold text-neutral-500 uppercase tracking-[0.2em]">Theme Selection</h3>
                      <p className="text-neutral-600 dark:text-neutral-400 text-sm mt-1">Adjust the visual tone of your workspace.</p>
                    </div>
                    <div className="grid grid-cols-1 gap-3 min-[520px]:grid-cols-3 sm:gap-4">
                      {["Light", "Dark", "System"].map(t => {
                        const isSelected = theme === t.toLowerCase();
                        return (
                          <button 
                            key={t} 
                            onClick={() => handleThemeChange(t.toLowerCase())}
                            className={`settings-glass-card group relative flex min-h-32 flex-col items-center justify-center rounded-2xl border border-white/45 p-5 backdrop-blur-xl hover-lift active-press dark:border-white/10 ${
                              isSelected ? 'bg-white/45 shadow-[inset_0_2px_8px_hsl(220_30%_30%/0.10)] dark:bg-white/10 ring-2 ring-primary' : 'bg-white/20 hover:bg-white/35 dark:bg-white/[0.03] dark:hover:bg-white/10'
                            }`}
                          >
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
                              isSelected ? 'bg-white/80 dark:bg-neutral-900/80 shadow-sm' : 'bg-white/50 dark:bg-neutral-800/50 shadow-lg'
                            }`}>
                              <Palette size={20} className={isSelected ? 'text-primary' : 'text-neutral-500 dark:text-neutral-400'} />
                            </div>
                            <span className={`tracking-tight ${isSelected ? 'text-neutral-900 dark:text-neutral-100 font-medium' : 'text-neutral-600 dark:text-neutral-400 font-light'}`}>
                              {t}
                            </span>
                            {isSelected && <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-primary animate-pulse" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Accent Color */}
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-semibold text-neutral-500 uppercase tracking-[0.2em]">Accent Color</h3>
                      <p className="text-neutral-600 dark:text-neutral-400 text-sm mt-1">Personalize primary interaction colors.</p>
                    </div>
                    <div className="flex flex-wrap gap-6 p-2">
                        {[
                        { id: "blue", bg: "bg-blue-500", glow: "soft-glow-blue" },
                        { id: "purple", bg: "bg-purple-500", glow: "soft-glow-purple" },
                        { id: "pink", bg: "bg-pink-500", glow: "soft-glow-pink" },
                        { id: "teal", bg: "bg-teal-500", glow: "soft-glow-teal" },
                        { id: "orange", bg: "bg-orange-500", glow: "" },
                        { id: "indigo", bg: "bg-indigo-400", glow: "" },
                        { id: "black", bg: "bg-zinc-900 dark:bg-white", glow: "" }
                      ].map(c => (
                        <button 
                          key={c.id} 
                          onClick={() => handleAccentChange(c.id)}
                          aria-label={`${c.id} accent`}
                          className={`h-11 w-11 rounded-full border border-white/50 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.45),0_8px_18px_hsl(220_30%_10%/0.08)] ${c.bg} hover-lift active-press dark:border-white/10 ${
                            accent === c.id ? `ring-4 ring-white/60 dark:ring-white/20 ${c.glow}` : 'hover:' + c.glow
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Font Family */}
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-semibold text-neutral-500 uppercase tracking-[0.2em]">Font Family</h3>
                      <p className="text-neutral-600 dark:text-neutral-400 text-sm mt-1">Choose a typeface that suits your reading style.</p>
                    </div>
                    <div className="max-w-md relative group">
                      <CustomSelect
                        value={font}
                        onChange={handleFontChange}
                        options={["Inter", "Roboto", "Outfit", "Playfair Display", "Kaori UI"].map(f => ({ value: f, label: f }))}
                        label="Font Family Selection"
                        size="lg"
                      />
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
                    <div className="settings-glass-card relative z-20 space-y-4 rounded-2xl border border-white/45 bg-white/30 p-5 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.35)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]">
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Default Provider</label>
                        <CustomSelect
                          value={provider}
                          onChange={handleProviderChange}
                          options={[
                            { value: "google", label: "Google" },
                            { value: "groq", label: "Groq" }
                          ]}
                          label="Default Provider"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Default Model</label>
                        <CustomSelect
                          value={model}
                          onChange={handleModelChange}
                          options={provider === "google" 
                            ? [{ value: "gemini-2.5-flash", label: "gemini-2.5-flash" }] 
                            : [
                                { value: "llama-3.3-70b-versatile", label: "llama-3.3-70b-versatile" },
                              ]
                          }
                          label="Default Model"
                        />
                      </div>
                    </div>

                    <div className="settings-glass-card relative z-10 space-y-4 rounded-2xl border border-white/45 bg-white/30 p-5 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.35)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]">
                      {/* Extended thinking removed since we aren't using Opus */}
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <div className="font-medium text-neutral-900 dark:text-neutral-100">Study Mode</div>
                          <div className="text-sm text-neutral-500">Provide hints instead of direct answers.</div>
                        </div>
                        <div 
                          onClick={toggleStudyMode}
                          className={`relative h-6 w-10 shrink-0 cursor-pointer rounded-full transition-colors ${studyMode ? 'bg-primary' : 'bg-neutral-200 dark:bg-neutral-700'}`}
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
                    <div className="settings-glass-card flex flex-col gap-4 rounded-2xl border border-white/45 bg-white/30 p-5 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.35)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04] sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-500">
                          G
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-neutral-900 dark:text-neutral-100">Google</div>
                          <div className="text-sm text-neutral-500">Drive & Gmail access</div>
                        </div>
                      </div>
                      <a href="/api/auth/google" className="inline-flex h-10 w-full shrink-0 items-center justify-center rounded-xl bg-blue-500 px-4 text-sm font-medium text-white hover-lift active-press hover:bg-blue-600 sm:w-auto">
                        Connect
                      </a>
                    </div>

                    <div className="settings-glass-card flex flex-col gap-4 rounded-2xl border border-white/45 bg-white/30 p-5 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.35)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04] sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center text-green-500">
                          S
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-neutral-900 dark:text-neutral-100">Spotify</div>
                          <div className="text-sm text-neutral-500">Playback control</div>
                        </div>
                      </div>
                      <a href="/api/auth/spotify" className="inline-flex h-10 w-full shrink-0 items-center justify-center rounded-xl bg-neutral-900 px-4 text-sm font-medium text-white hover-lift active-press hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white sm:w-auto">
                        Connect
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* USAGE */}
              {activeTab === "usage" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-center gap-3">
                    <h3 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Usage limits</h3>
                    {isPro && (
                      <span className="px-2 py-0.5 rounded-md bg-neutral-200 dark:bg-white/10 text-[10px] uppercase font-semibold tracking-wider text-neutral-600 dark:text-neutral-400">
                        Pro
                      </span>
                    )}
                  </div>
                  
                  <p className="text-neutral-600 dark:text-neutral-400 text-[15px] leading-relaxed max-w-[90%]">
                    Your plan's limits determine how much you can use Kaori over time. Advanced models and features can take up more usage. <a href="#" className="text-blue-500 hover:underline">Learn more</a>
                  </p>
                  
                  <p className="text-neutral-500 dark:text-neutral-500 text-sm font-medium">Updated just now</p>
                  
                  {usageLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 size={20} className="animate-spin text-neutral-400" />
                      <span className="ml-2 text-sm text-neutral-500">Loading usage data...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      
                      {/* Section 1: Messages */}
                      <div className="settings-glass-card p-5 sm:p-6 rounded-[1.25rem] border border-white/45 bg-white/30 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.35)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]">
                        <div className="flex justify-between items-end mb-4">
                          <div className="flex items-center gap-2">
                            <span className="text-[15px] font-semibold text-neutral-900 dark:text-neutral-100">Current usage</span>
                            <Info size={16} className="text-neutral-400" />
                          </div>
                          <span className="text-[15px] font-bold text-neutral-900 dark:text-neutral-100">
                            {isPro ? "Unlimited" : `${Math.round(((usageData?.messagesToday ?? 0) / (usageData?.messageLimit ?? 100)) * 100)}% used`}
                          </span>
                        </div>
                        
                        <div className="h-2.5 w-full bg-neutral-200 dark:bg-black rounded-full overflow-hidden mb-3">
                          {!isPro && (
                            <div 
                              className="h-full bg-neutral-800 dark:bg-neutral-200 rounded-full transition-all duration-1000 ease-out" 
                              style={{ width: `${Math.min(100, ((usageData?.messagesToday ?? 0) / (usageData?.messageLimit ?? 100)) * 100)}%` }}
                            />
                          )}
                          {isPro && (
                            <div className="h-full w-full bg-gradient-to-r from-blue-400 to-indigo-500" />
                          )}
                        </div>
                        
                        <div className="text-[13px] font-medium text-neutral-500 dark:text-neutral-400">
                          {isPro ? "No daily limit" : "Resets at midnight"}
                        </div>
                      </div>

                    </div>
                  )}

                  {!isPro && (
                    <div className="settings-glass-card mt-8 space-y-4 rounded-2xl border border-white/45 bg-white/30 p-5 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.35)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 font-medium text-neutral-900 dark:text-neutral-100">
                            Kaori Pro 
                            <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">BETA</span>
                          </div>
                          <div className="text-sm text-neutral-500">Try Kaori Pro for free during our beta period.</div>
                        </div>
                        <button 
                          onClick={() => {
                            setIsPro(true);
                            setStatusMsg("Welcome to the Kaori Pro Beta!");
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="inline-flex h-10 w-full shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--primary))] px-4 text-sm font-medium text-white hover-lift active-press hover:brightness-110 sm:w-auto"
                          title="Join Beta"
                        >
                          Join Beta
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* FOCUS MODE */}
              {activeTab === "focus" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <h3 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Focus Mode</h3>
                  <p className="text-neutral-500 dark:text-neutral-400 text-sm">Stay productive with the Pomodoro technique.</p>
                  
                  <div className="settings-glass-card rounded-2xl border border-white/45 bg-white/30 p-5 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.35)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04] sm:p-6">
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
                    <div className="settings-glass-card space-y-4 rounded-2xl border border-white/45 bg-white/30 p-5 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.35)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="font-medium text-neutral-900 dark:text-neutral-100">Export Conversations</div>
                          <div className="text-sm text-neutral-500">Download all your chats as Markdown.</div>
                        </div>
                        <button onClick={handleExportData} className="inline-flex h-10 w-full shrink-0 items-center justify-center rounded-xl border border-white/45 bg-white/35 px-4 text-sm font-medium hover-lift active-press hover:bg-white/55 dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/10 sm:w-auto">
                          Export ZIP
                        </button>
                      </div>
                      <hr className="border-neutral-100 dark:border-neutral-800" />
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="font-medium text-neutral-900 dark:text-neutral-100">Export My Data (GDPR)</div>
                          <div className="text-sm text-neutral-500">Request a full export of your profile and data.</div>
                        </div>
                        <button onClick={handleRequestGDPRData} className="inline-flex h-10 w-full shrink-0 items-center justify-center rounded-xl border border-white/45 bg-white/35 px-4 text-sm font-medium hover-lift active-press hover:bg-white/55 dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/10 sm:w-auto">
                          Request Data
                        </button>
                      </div>
                    </div>

                    <div className="settings-glass-danger space-y-4 rounded-2xl border border-red-200/80 bg-red-50/55 p-5 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.4)] backdrop-blur-xl dark:border-red-900/50 dark:bg-red-900/10">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="font-medium text-red-600 dark:text-red-400">Delete All Conversations</div>
                          <div className="text-sm text-red-500/80">This action cannot be undone.</div>
                        </div>
                        <button onClick={handleDeleteAllChats} className="inline-flex h-10 w-full shrink-0 items-center justify-center rounded-xl bg-red-100 px-4 text-sm font-medium text-red-700 hover-lift active-press hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60 sm:w-auto">
                          Delete Chats
                        </button>
                      </div>
                      <hr className="border-red-200 dark:border-red-900/50" />
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="font-medium text-red-600 dark:text-red-400">Delete Account</div>
                          <div className="text-sm text-red-500/80">Permanently remove your account and data.</div>
                        </div>
                        <button onClick={handleDeleteAccount} className="inline-flex h-10 w-full shrink-0 items-center justify-center rounded-xl bg-red-600 px-4 text-sm font-medium text-white hover-lift active-press hover:bg-red-700 sm:w-auto">
                          Delete Account
                        </button>
                      </div>
                      <hr className="border-red-200 dark:border-red-900/50" />
                      <div className="flex flex-col gap-4 md:hidden">
                        <div className="min-w-0">
                          <div className="font-medium text-red-600 dark:text-red-400">Logout</div>
                          <div className="text-sm text-red-500/80">Sign out of your account on this device.</div>
                        </div>
                        <button 
                          onClick={async () => {
                            await fetch('/api/auth/logout', { method: 'POST', headers: AJAX_HEADERS });
                            window.location.href = '/login';
                          }} 
                          className="inline-flex h-10 items-center justify-center rounded-xl bg-red-100 px-4 text-sm font-medium text-red-700 hover-lift active-press hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60"
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
      )}
    </AnimatePresence>
  );
}
