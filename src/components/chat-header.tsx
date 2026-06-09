"use client";

import { Sun, Moon, Menu } from "lucide-react";

export default function ChatHeader({
  onToggleSidebar,
  sidebarOpen,
}: {
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
}) {
  const toggleTheme = () => {
    document.body.classList.toggle("dark");
  };

  return (
    <header className="h-14 shrink-0 flex items-center justify-between px-4 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))] glass z-20">
      <div className="flex items-center gap-2">
        {!sidebarOpen && (
          <button
            onClick={onToggleSidebar}
            className="h-9 w-9 grid place-items-center rounded-lg hover:bg-[hsl(var(--muted))] transition-colors"
          >
            <Menu size={18} />
          </button>
        )}

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg claude-gradient flex items-center justify-center text-white text-xs font-bold">
            K
          </div>
          <span className="font-semibold text-sm tracking-tight hidden sm:inline">Kaori</span>
        </div>
      </div>

      <div className="flex-1" />

      <button
        onClick={toggleTheme}
        className="h-9 w-9 grid place-items-center rounded-lg hover:bg-[hsl(var(--muted))] transition-colors"
        aria-label="Toggle theme"
      >
        <Sun size={16} className="dark:hidden" />
        <Moon size={16} className="hidden dark:block" />
      </button>
    </header>
  );
}
