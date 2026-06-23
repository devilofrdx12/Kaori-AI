"use client";

import Image from "next/image";

export default function TypingIndicator() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 animate-fade-in">
      <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 border border-white/70 dark:border-white/10 shadow-sm">
        <Image src="/kaori-avatar.png" alt="Kaori" width={28} height={28} className="w-full h-full object-cover" />
      </div>
      <div className="flex items-center gap-1.5 px-4 py-3 rounded-2xl bg-white/62 dark:bg-white/5 border border-white/70 dark:border-white/10 shadow-sm">
        <div className="typing-dot" />
        <div className="typing-dot" />
        <div className="typing-dot" />
      </div>
    </div>
  );
}
