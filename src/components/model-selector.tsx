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
            ? "flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800/50 transition-colors"
            : "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
        }
      >
        {!minimal && getIcon(current)}
        <span>{current.label}</span>
        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""} ${minimal ? "text-neutral-400" : ""}`} />
      </button>

      {open && (
        <div 
          className={`absolute ${direction === "up" ? "bottom-full mb-1" : "top-full mt-1"} right-0 sm:left-0 sm:right-auto w-[280px] sm:w-72 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--popover))] shadow-xl z-50 overflow-hidden animate-fade-in`}
        >
          {MODEL_OPTIONS.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                onChange(m.id);
                setOpen(false);
              }}
              className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-[hsl(var(--muted))] transition-colors ${
                m.id === model ? "bg-[hsl(var(--muted))]" : ""
              }`}
            >
              <div className="mt-0.5">{getIcon(m)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[hsl(var(--foreground))]">
                    {m.label}
                  </span>
                  {m.badge && (
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[hsl(var(--primary)/0.15)] text-[hsl(var(--primary))]">
                      {m.badge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                  {m.description}
                </p>
              </div>
              {m.id === model && (
                <div className="w-2 h-2 rounded-full bg-[hsl(var(--primary))] mt-1.5" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
