"use client";

export default function TypingIndicator() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 animate-fade-in">
      <div className="w-7 h-7 rounded-full claude-gradient flex items-center justify-center text-white text-xs font-bold shrink-0">
        K
      </div>
      <div className="flex items-center gap-1.5 px-4 py-3 rounded-2xl bg-[hsl(var(--assistant-bubble))] border border-[hsl(var(--border))]">
        <div className="typing-dot" />
        <div className="typing-dot" />
        <div className="typing-dot" />
      </div>
    </div>
  );
}
