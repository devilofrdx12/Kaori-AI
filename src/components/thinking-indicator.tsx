"use client";

import { Globe, Loader2 } from "lucide-react";
import Image from "next/image";

export default function ThinkingIndicator({ toolName }: { toolName?: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 animate-fade-in">
      <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 border border-white/70 dark:border-white/10 shadow-sm">
        <Image src="/kaori-avatar.png" alt="Kaori" width={28} height={28} className="w-full h-full object-cover" />
      </div>
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl thinking-shimmer border border-white/70 dark:border-white/10 shadow-sm">
        {toolName ? (
          <>
            <Globe size={14} className="text-[hsl(var(--primary))] animate-pulse" />
            <span className="text-sm text-[hsl(var(--muted-foreground))]">
              {toolName === "web_search"
                ? "Searching the web…"
                : toolName === "web_fetch"
                ? "Reading webpage…"
                : `Using ${toolName}…`}
            </span>
          </>
        ) : (
          <>
            <Loader2 size={14} className="text-[hsl(var(--primary))] animate-spin" />
            <span className="text-sm text-[hsl(var(--muted-foreground))]">Thinking…</span>
          </>
        )}
      </div>
    </div>
  );
}
