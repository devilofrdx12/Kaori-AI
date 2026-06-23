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
    <header className="h-14 shrink-0 flex items-center justify-between px-4 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))] z-20">
      {/* Left side */}
      <div className="flex items-center gap-2">
        {!sidebarOpen && (
          <button
            onClick={onToggleSidebar}
            className="h-11 w-11 grid place-items-center rounded-lg hover:bg-[hsl(var(--muted))] transition-colors text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          >
            <Menu size={18} />
          </button>
        )}

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg overflow-hidden shrink-0 border border-[hsl(var(--border))]">
            <Image src="/kaori-avatar.png" alt="Kaori" width={28} height={28} className="w-full h-full object-cover" />
          </div>
          <span className="font-semibold text-sm tracking-tight hidden sm:inline">Kaori</span>
        </div>
      </div>

      <div className="flex-1" />

      {/* Right side — toggle avatar */}
      <button
        onClick={onToggleAvatar}
        className="h-9 w-9 grid place-items-center rounded-lg hover:bg-[hsl(var(--muted))] transition-colors text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
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
