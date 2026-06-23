"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Sparkles, Zap, Brain } from "lucide-react";
import { MODEL_OPTIONS, ModelOption } from "./types";

export default function ModelSelector({
  model,
  onChange,
  direction = "down",
  minimal = false,
}: {
  model: string;
  onChange: (id: string) => void;
  direction?: "up" | "down";
  minimal?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = MODEL_OPTIONS.find((m) => m.id === model) || MODEL_OPTIONS[0];

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const getIcon = (m: ModelOption) => {
    if (m.label.includes("Opus")) return <Brain size={16} className="text-purple-400" />;
    if (m.label.includes("Haiku")) return <Zap size={16} className="text-yellow-400" />;
    return <Sparkles size={16} className="text-[hsl(var(--primary))]" />;
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={
          minimal
            ? "flex min-w-0 items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium text-secondary hover:text-on-surface hover:bg-white/55 dark:hover:bg-white/10 transition-all duration-200 max-w-[160px] active:scale-95"
            : "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-on-surface hover:bg-white/55 dark:hover:bg-white/10 transition-all duration-200 active:scale-95"
        }
      >
        {!minimal && <div className="shrink-0">{getIcon(current)}</div>}
        <span className="truncate">{current.label}</span>
        <ChevronDown size={14} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""} ${minimal ? "text-neutral-400" : ""}`} />
      </button>

      {open && (
        <div
          className={`absolute ${direction === "up" ? "bottom-full mb-2" : "top-full mt-2"} left-0 w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-white/70 dark:border-white/10 bg-white/90 dark:bg-neutral-950/92 backdrop-blur-2xl shadow-2xl z-50 overflow-hidden animate-fade-in`}
        >
          {MODEL_OPTIONS.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                onChange(m.id);
                setOpen(false);
              }}
              className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-white/65 dark:hover:bg-white/10 transition-all duration-200 ${
                m.id === model ? "bg-white/70 dark:bg-white/10" : ""
              }`}
            >
              <div className="mt-0.5 shrink-0">{getIcon(m)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-on-surface">
                    {m.label}
                  </span>
                  {m.badge && (
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">
                      {m.badge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-secondary mt-0.5">
                  {m.description}
                </p>
              </div>
              {m.id === model && (
                <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
