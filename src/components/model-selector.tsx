"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Sparkles, Zap, Brain, Check } from "lucide-react";
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
        type="button"
        onClick={() => setOpen(!open)}
        className={
          minimal
            ? `flex w-full min-w-0 items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-1 sm:py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 max-w-full sm:max-w-[170px] active:scale-95 ${
                open
                  ? "border-white/55 dark:border-white/10 bg-white/55 dark:bg-white/10 backdrop-blur-md text-on-surface"
                  : "border-transparent text-secondary hover:text-on-surface hover:border-white/55 dark:hover:border-white/10 hover:bg-white/55 dark:hover:bg-white/10 hover:backdrop-blur-md"
              }`
            : `flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-200 active:scale-95 ${
                open
                  ? "border-white/55 dark:border-white/10 bg-white/55 dark:bg-white/10 backdrop-blur-md text-on-surface"
                  : "border-transparent text-on-surface hover:border-white/55 dark:hover:border-white/10 hover:bg-white/55 dark:hover:bg-white/10 hover:backdrop-blur-md"
              }`
        }
      >
        {!minimal && <div className="shrink-0">{getIcon(current)}</div>}
        <span className="truncate">{current.label}</span>
        <ChevronDown size={14} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""} ${minimal ? "text-neutral-400" : ""}`} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Model options"
          className={`absolute ${direction === "up" ? "bottom-full mb-2" : "top-full mt-2"} left-0 w-[min(19rem,calc(100vw-2rem))] max-h-[15rem] rounded-2xl border border-white/65 dark:border-white/10 bg-white/75 dark:bg-neutral-950/75 p-1.5 backdrop-blur-2xl backdrop-saturate-150 shadow-2xl z-50 overflow-y-auto overflow-x-hidden animate-fade-in`}
        >
          {MODEL_OPTIONS.map((m) => {
            const selected = m.id === model;
            return (
              <button
                key={m.id}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => {
                  onChange(m.id);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2.5 rounded-xl flex items-start gap-2.5 transition-colors ${
                  selected
                    ? "bg-white/75 dark:bg-white/10 shadow-sm"
                    : "hover:bg-white/45 dark:hover:bg-white/[0.06]"
                }`}
              >
                <div className="mt-0.5 shrink-0">{getIcon(m)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-sm ${
                        selected ? "font-semibold text-primary" : "font-medium text-on-surface"
                      }`}
                    >
                      {m.label}
                    </span>
                    {m.badge && (
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full border border-white/50 dark:border-white/10 bg-white/45 dark:bg-white/[0.06] ${
                          selected ? "text-primary" : "text-secondary"
                        }`}
                      >
                        {m.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-secondary mt-0.5">
                    {m.description}
                  </p>
                </div>
                {selected && (
                  <Check size={14} className="shrink-0 text-primary mt-1" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
