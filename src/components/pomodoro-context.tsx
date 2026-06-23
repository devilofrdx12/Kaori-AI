"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";

export type TimerMode = "focus" | "break";

interface PomodoroContextType {
  mode: TimerMode;
  focusMins: number;
  breakMins: number;
  secondsLeft: number;
  running: boolean;
  sessions: number;
  toggleRunning: () => void;
  reset: () => void;
  switchMode: (newMode: TimerMode) => void;
  setFocusMins: (mins: number) => void;
  setBreakMins: (mins: number) => void;
}

const PomodoroContext = createContext<PomodoroContextType | null>(null);

function getInitialSessionCount() {
  if (typeof window === "undefined") return 0;

  const stored = localStorage.getItem("kaori_pomodoro_sessions");
  const storedDate = localStorage.getItem("kaori_pomodoro_date");
  const today = new Date().toDateString();

  if (storedDate !== today || !stored) return 0;

  const parsed = parseInt(stored, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function usePomodoro() {
  const ctx = useContext(PomodoroContext);
  if (!ctx) throw new Error("usePomodoro must be used within PomodoroProvider");
  return ctx;
}

// Single audio context for the whole app
let audioCtx: AudioContext | null = null;
function playNotificationSound() {
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = 800;
    gain.gain.value = 0.1;
    osc.start();
    osc.stop(audioCtx.currentTime + 0.3);
  } catch (err) {
    console.error("Audio error", err);
  }
}

function sendBrowserNotification(title: string, body: string) {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    new Notification(title, { body, icon: "/favicon.ico" });
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then((perm) => {
      if (perm === "granted") {
        new Notification(title, { body, icon: "/favicon.ico" });
      }
    });
  }
}

export function PomodoroProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<TimerMode>("focus");
  const [focusMins, setFocusMinsState] = useState(25);
  const [breakMins, setBreakMinsState] = useState(5);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [sessions, setSessions] = useState(getInitialSessionCount);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initialTitleRef = useRef<string | null>(null);

  // Keep local storage's day marker fresh without deriving React state in an effect.
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedDate = localStorage.getItem("kaori_pomodoro_date");
      const today = new Date().toDateString();

      if (storedDate !== today) {
        localStorage.setItem("kaori_pomodoro_date", today);
        localStorage.setItem("kaori_pomodoro_sessions", "0");
      }

      initialTitleRef.current = document.title;
    }
  }, []);

  const saveSessions = (count: number) => {
    setSessions(count);
    localStorage.setItem("kaori_pomodoro_sessions", count.toString());
    localStorage.setItem("kaori_pomodoro_date", new Date().toDateString());
  };

  const switchMode = useCallback((newMode: TimerMode) => {
    setMode(newMode);
    setRunning(false);
    setSecondsLeft(newMode === "focus" ? focusMins * 60 : breakMins * 60);
  }, [focusMins, breakMins]);

  const setFocusMins = useCallback((mins: number) => {
    setFocusMinsState(mins);
    if (!running && mode === "focus") {
      setSecondsLeft(mins * 60);
    }
  }, [mode, running]);

  const setBreakMins = useCallback((mins: number) => {
    setBreakMinsState(mins);
    if (!running && mode === "break") {
      setSecondsLeft(mins * 60);
    }
  }, [mode, running]);

  // Request notification permission if not granted
  useEffect(() => {
    if (running && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, [running]);

  // Document title updates
  useEffect(() => {
    if (!running) {
      if (initialTitleRef.current) document.title = initialTitleRef.current;
      return;
    }
    const mins = Math.floor(secondsLeft / 60);
    const secs = secondsLeft % 60;
    const timeStr = `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    const modeEmoji = mode === "focus" ? "🧠" : "☕";
    document.title = `(${timeStr}) ${modeEmoji} Kaori AI`;
  }, [secondsLeft, running, mode]);

  // Timer tick
  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setRunning(false);
          playNotificationSound();

          if (mode === "focus") {
            saveSessions(sessions + 1);
            sendBrowserNotification("Focus Complete!", "Great job. Time for a short break.");
            switchMode("break");
          } else {
            sendBrowserNotification("Break Over", "Ready to focus again?");
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
  }, [running, mode, sessions, switchMode]);

  const toggleRunning = () => setRunning((p) => !p);

  const reset = () => {
    setRunning(false);
    setSecondsLeft(mode === "focus" ? focusMins * 60 : breakMins * 60);
  };

  return (
    <PomodoroContext.Provider
      value={{
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
      }}
    >
      {children}
    </PomodoroContext.Provider>
  );
}
