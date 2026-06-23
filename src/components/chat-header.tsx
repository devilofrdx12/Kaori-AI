"use client";

import { Eye, EyeOff, Menu } from "lucide-react";
import Image from "next/image";

export default function ChatHeader({
  onToggleSidebar,
  sidebarOpen,
  showAvatar,
  onToggleAvatar,
}: {
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
  showAvatar: boolean;
  onToggleAvatar: () => void;
}) {

  return (
    <header className="h-14 sm:h-16 shrink-0 flex items-center justify-between px-3 sm:px-5 border-b border-white/60 dark:border-white/10 bg-white/50 dark:bg-neutral-950/35 backdrop-blur-xl z-20">
      {/* Left side */}
      <div className="flex items-center gap-2">
        {!sidebarOpen && (
          <button
            onClick={onToggleSidebar}
            title="Toggle Sidebar"
            className="h-10 w-10 sm:h-11 sm:w-11 grid place-items-center rounded-xl hover:bg-white/65 dark:hover:bg-white/10 transition-all duration-200 text-secondary hover:text-on-surface hover:-translate-y-0.5 active:translate-y-0 active:scale-95"
          >
            <Menu size={18} />
          </button>
        )}

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl overflow-hidden shrink-0 border border-white/70 dark:border-white/10 shadow-sm">
            <Image src="/kaori-avatar.png" alt="Kaori" width={28} height={28} className="w-full h-full object-cover" />
          </div>
          <span className="font-semibold text-sm tracking-tight hidden sm:inline text-on-surface">Kaori</span>
        </div>
      </div>

      <div className="flex-1" />

      {/* Right side — toggle avatar */}
      <button
        onClick={onToggleAvatar}
        className="h-10 w-10 grid place-items-center rounded-xl hover:bg-white/65 dark:hover:bg-white/10 transition-all duration-200 text-secondary hover:text-on-surface hover:-translate-y-0.5 active:translate-y-0 active:scale-95"
        title={showAvatar ? "Hide Kaori" : "Show Kaori"}
      >
        {showAvatar ? (
          <EyeOff size={18} />
        ) : (
          <Eye size={18} />
        )}
      </button>
    </header>
  );
}
