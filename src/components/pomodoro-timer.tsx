"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Pause, RotateCcw, Coffee, Brain, X, ChevronDown } from "lucide-react";

type TimerMode = "focus" | "break";

const PRESETS = {
  focus: [15, 25, 30, 45, 60],
  break: [5, 10, 15],
};

export default function PomodoroTimer({ onClose }: { onClose?: () => void }) {
  const [mode, setMode] = useState<TimerMode>("focus");
  const [focusMins, setFocusMins] = useState(25);
  const [breakMins, setBreakMins] = useState(5);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [sessions, setSessions] = useState(0);
  const [showPresets, setShowPresets] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
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

  const switchMode = useCallback(
    (newMode: TimerMode) => {
      setMode(newMode);
      setRunning(false);
      setSecondsLeft(newMode === "focus" ? focusMins * 60 : breakMins * 60);
    },
    [focusMins, breakMins]
  );

  // Timer tick
  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          // Timer complete
          setRunning(false);
          if (mode === "focus") {
            setSessions((s) => s + 1);
            // Play a subtle notification sound
            try {
              const ctx = new AudioContext();
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.frequency.value = 800;
              gain.gain.value = 0.1;
              osc.start();
              osc.stop(ctx.currentTime + 0.3);
            } catch {}
            // Auto-switch to break
            switchMode("break");
          } else {
            switchMode("focus");
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, mode, switchMode]);

  const toggleRunning = () => setRunning((p) => !p);

  const reset = () => {
    setRunning(false);
    setSecondsLeft(mode === "focus" ? focusMins * 60 : breakMins * 60);
  };

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
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => switchMode("focus")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              mode === "focus"
                ? "bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))] ring-1 ring-[hsl(var(--primary)/0.3)]"
                : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            }`}
          >
            <Brain size={16} />
            Focus
          </button>
          <button
            onClick={() => switchMode("break")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              mode === "break"
                ? "bg-green-500/12 text-green-600 dark:text-green-400 ring-1 ring-green-500/30"
                : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
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
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            {mode === "focus" ? focusMins : breakMins} min
            <ChevronDown
              size={12}
              className={`transition-transform ${showPresets ? "rotate-180" : ""}`}
            />
          </button>
          {showPresets && (
            <div className="absolute right-0 top-full mt-1 bg-white dark:bg-[#1c1c1c] border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xl z-10 overflow-hidden animate-fade-in min-w-[120px]">
              <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                Duration
              </div>
              {(mode === "focus" ? PRESETS.focus : PRESETS.break).map((mins) => (
                <button
                  key={mins}
                  onClick={() => {
                    if (mode === "focus") {
                      setFocusMins(mins);
                      if (!running) setSecondsLeft(mins * 60);
                    } else {
                      setBreakMins(mins);
                      if (!running) setSecondsLeft(mins * 60);
                    }
                    setShowPresets(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors ${
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
        <div className="relative w-52 h-52">
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
