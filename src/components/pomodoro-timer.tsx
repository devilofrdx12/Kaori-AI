"use client";

import { useState, useEffect, useRef } from "react";
import { Play, Pause, RotateCcw, Coffee, Brain, X, ChevronDown } from "lucide-react";
import { usePomodoro } from "./pomodoro-context";

const PRESETS = {
  focus: [15, 25, 30, 45, 60],
  break: [5, 10, 15],
};

export default function PomodoroTimer({ onClose }: { onClose?: () => void }) {
  const {
    mode,
    focusMins,
    breakMins,
    secondsLeft,
    running,
    sessions,
    toggleRunning,
    reset,
    switchMode,
    setFocusMins,
    setBreakMins,
  } = usePomodoro();

  const [showPresets, setShowPresets] = useState(false);
  const presetsRef = useRef<HTMLDivElement>(null);

  const totalSeconds = mode === "focus" ? focusMins * 60 : breakMins * 60;
  const progress = 1 - secondsLeft / totalSeconds;

  // Close presets dropdown on outside click
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (presetsRef.current && !presetsRef.current.contains(e.target as Node)) {
        setShowPresets(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // SVG ring
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div className="space-y-6">
      {/* Mode Toggle */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <button
            onClick={() => switchMode("focus")}
            className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
              mode === "focus"
                ? "bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))] ring-1 ring-[hsl(var(--primary)/0.3)]"
                : "text-neutral-600 hover:bg-white/35 dark:text-neutral-400 dark:hover:bg-white/10"
            }`}
          >
            <Brain size={16} />
            Focus
          </button>
          <button
            onClick={() => switchMode("break")}
            className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
              mode === "break"
                ? "bg-green-500/12 text-green-600 dark:text-green-400 ring-1 ring-green-500/30"
                : "text-neutral-600 hover:bg-white/35 dark:text-neutral-400 dark:hover:bg-white/10"
            }`}
          >
            <Coffee size={16} />
            Break
          </button>
        </div>

        {/* Presets dropdown */}
        <div ref={presetsRef} className="relative">
          <button
            onClick={() => setShowPresets(!showPresets)}
            className="settings-glass-card flex h-9 items-center justify-center gap-1 rounded-xl border border-white/40 bg-white/25 px-3 text-xs font-medium text-neutral-500 transition-colors hover:bg-white/40 dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/10 sm:justify-start"
          >
            {mode === "focus" ? focusMins : breakMins} min
            <ChevronDown
              size={12}
              className={`transition-transform ${showPresets ? "rotate-180" : ""}`}
            />
          </button>
          {showPresets && (
            <div className="settings-glass-card absolute right-0 top-full z-10 mt-1 min-w-[120px] overflow-hidden rounded-xl border border-white/45 bg-white/80 shadow-xl backdrop-blur-xl animate-fade-in dark:border-white/10 dark:bg-neutral-950/85">
              <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                Duration
              </div>
              {(mode === "focus" ? PRESETS.focus : PRESETS.break).map((mins) => (
                <button
                  key={mins}
                  onClick={() => {
                    if (mode === "focus") {
                      setFocusMins(mins);
                    } else {
                      setBreakMins(mins);
                    }
                    setShowPresets(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-sm transition-colors hover:bg-white/60 dark:hover:bg-white/10 ${
                    (mode === "focus" ? focusMins : breakMins) === mins
                      ? "text-[hsl(var(--primary))] font-medium"
                      : "text-neutral-700 dark:text-neutral-300"
                  }`}
                >
                  {mins} minutes
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Circular Timer */}
      <div className="flex flex-col items-center">
        <div className="relative h-44 w-44 sm:h-52 sm:w-52">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
            {/* Track */}
            <circle
              cx="100"
              cy="100"
              r={radius}
              fill="none"
              stroke="hsl(var(--border))"
              strokeWidth="6"
            />
            {/* Progress */}
            <circle
              cx="100"
              cy="100"
              r={radius}
              fill="none"
              stroke={mode === "focus" ? "hsl(var(--primary))" : "hsl(142 71% 45%)"}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-1000 ease-linear"
            />
          </svg>

          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100 tabular-nums">
              {formatTime(secondsLeft)}
            </span>
            <span className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 uppercase tracking-wider font-medium">
              {mode === "focus" ? "Focus Time" : "Break Time"}
            </span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={reset}
          className="h-10 w-10 grid place-items-center rounded-full border border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all"
          title="Reset"
        >
          <RotateCcw size={16} />
        </button>

        <button
          onClick={toggleRunning}
          className={`h-14 w-14 grid place-items-center rounded-full text-white transition-all shadow-lg hover:shadow-xl active:scale-95 ${
            mode === "focus"
              ? "bg-[hsl(var(--primary))] hover:brightness-110"
              : "bg-green-500 hover:bg-green-600"
          }`}
          title={running ? "Pause" : "Start"}
        >
          {running ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" className="ml-0.5" />}
        </button>

        {onClose && (
          <button
            onClick={onClose}
            className="h-10 w-10 grid place-items-center rounded-full border border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all"
            title="Close"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Session count */}
      <div className="text-center">
        <span className="text-xs text-neutral-400 dark:text-neutral-500 font-medium">
          {sessions} session{sessions !== 1 ? "s" : ""} completed today
        </span>
      </div>
    </div>
  );
}
