"use client";

import React, { useRef, useState, useEffect, useMemo } from "react";
import { ArrowUp, Mic, Plus, Square, X, AudioLines, Globe, ChevronDown, Check } from "lucide-react";
import ModelSelector from "./model-selector";

const VOICE_LANGUAGES = [
  { value: "en-US", label: "English" },
  { value: "ja-JP", label: "Japanese" },
  { value: "ta-IN", label: "Tamil" },
  { value: "te-IN", label: "Telugu" },
  { value: "ml-IN", label: "Malayalam" },
  { value: "hi-IN", label: "Hindi" },
  { value: "zh-CN", label: "Chinese" },
  { value: "ro-RO", label: "Romanian" },
];

export default function ChatInput({
  onSend,
  disabled,
  onStop,
  model,
  onModelChange,
  placeholder,
}: {
  onSend: (text: string, files?: File[] | null) => void;
  disabled?: boolean;
  onStop?: () => void;
  model: string;
  onModelChange: (id: string) => void;
  placeholder?: string;
}) {
  const [value, setValue] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [listening, setListening] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [voiceLang, setVoiceLang] = useState("en-US");
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isJerking, setIsJerking] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const voiceRecognitionRef = useRef<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const langMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) {
        setShowLangMenu(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = localStorage.getItem("kaori_voice_lang");
      if (saved) {
        setVoiceLang(saved);
      } else if (navigator.language) {
        setVoiceLang(navigator.language);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const handleVoiceLangChange = (lang: string) => {
    setVoiceLang(lang);
    localStorage.setItem("kaori_voice_lang", lang);
  };
  const filePreviews = useMemo(
    () =>
      files.map((file) => ({
        file,
        isImage: file.type.startsWith("image/"),
        url: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
      })),
    [files]
  );

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    // Save current height before measuring
    const currentHeight = el.style.height || "54px";

    // Disable transition temporarily to prevent glitching during measurement
    el.style.transition = "none";

    // Shrink to measure true scrollHeight
    el.style.height = "0px";
    const scrollHeight = el.scrollHeight;

    // Calculate target height with a 2px buffer for subpixel descender safety
    const targetHeight = Math.min(scrollHeight + 2, 180) + "px";

    // Restore previous height and force a layout reflow
    el.style.height = currentHeight;
    void el.offsetHeight; // The magic line that forces the browser to acknowledge the starting state

    // Re-enable the CSS transition and trigger the animation to the new height
    el.style.transition = "";
    el.style.height = targetHeight;
    el.style.overflowY = scrollHeight > 180 ? "auto" : "hidden";
  }, [value]);

  useEffect(() => {
    // Auto focus on mount and when not disabled (desktop only to prevent mobile keyboard pop)
    const isMobile = typeof window !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!isMobile && textareaRef.current && !disabled) {
      textareaRef.current.focus();
    }
  }, [disabled]);

  useEffect(() => {
    return () => filePreviews.forEach((p) => { if (p.url) URL.revokeObjectURL(p.url); });
  }, [filePreviews]);

  const handleSend = () => {
    const text = value.trim();
    if (!text && !files.length) return;
    onSend(text, files.length ? files : null);
    setValue("");
    setFiles([]);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      const isMobile = typeof window !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (!isMobile) {
        e.preventDefault();
        if (!disabled) handleSend();
      }
    }
  };

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (!selected.length) return;
    const validFiles = selected.filter((f) => f.type.startsWith("image/") || f.type === "application/pdf");
    setFiles((prev) => [...prev, ...validFiles].slice(0, 3));
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    // Physical weight impact for pasting paragraphs
    const text = e.clipboardData?.getData("text");
    if (text && text.length > 30) {
      setIsJerking(true);
      setTimeout(() => setIsJerking(false), 80); // 80ms heavy impact down
    }

    const items = e.clipboardData?.items;
    if (!items) return;
    const pastedFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/") || items[i].type === "application/pdf") {
        const file = items[i].getAsFile();
        if (file) pastedFiles.push(file);
      }
    }
    if (pastedFiles.length > 0) {
      setFiles((prev) => [...prev, ...pastedFiles].slice(0, 3));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/") || f.type === "application/pdf");
    if (droppedFiles.length > 0) {
      setFiles((prev) => [...prev, ...droppedFiles].slice(0, 3));
    }
  };

  const startVoice = () => {
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = voiceLang;
    recognition.continuous = false;
    recognition.interimResults = false;
    setListening(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";
      setValue((prev: string) => (prev ? `${prev} ${transcript}` : transcript));
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognition.start();
  };

  const toggleVoiceMode = () => {
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SpeechRecognition) return;

    if (voiceMode) {
      // Stop voice mode
      if (voiceRecognitionRef.current) {
        voiceRecognitionRef.current.onend = null; // prevent auto-restart
        voiceRecognitionRef.current.abort();
        voiceRecognitionRef.current = null;
      }
      setVoiceMode(false);
      return;
    }

    // Start continuous voice mode
    const recognition = new SpeechRecognition();
    recognition.lang = voiceLang;
    recognition.continuous = true;
    recognition.interimResults = false;
    voiceRecognitionRef.current = recognition;
    setVoiceMode(true);

    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          transcript += event.results[i][0].transcript;
        }
      }
      if (transcript) {
        setValue((prev: string) => (prev ? `${prev} ${transcript}` : transcript));
      }
    };

    recognition.onerror = (e: any) => {
      if (e.error !== "no-speech") {
        setVoiceMode(false);
        voiceRecognitionRef.current = null;
      }
    };

    recognition.onend = () => {
      // Auto-restart if voice mode is still active
      if (voiceRecognitionRef.current) {
        try {
          voiceRecognitionRef.current.start();
        } catch {
          setVoiceMode(false);
          voiceRecognitionRef.current = null;
        }
      }
    };

    recognition.start();
  };

  return (
    <div className="shrink-0 px-3 sm:px-4 pb-6 sm:pb-8 pt-2 w-full">
      <div className="max-w-3xl mx-auto">
        {/* Input Container */}
        <div
          className={`flex flex-col glass-panel rounded-[1.5rem] relative z-10 chat-input-box transition-all duration-300 ${isDragging ? "ring-2 ring-primary ring-offset-2 ring-offset-transparent bg-primary/5" : ""} ${isJerking ? "jerk-impact" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* File previews */}
          {filePreviews.length > 0 && (
            <div className="flex flex-wrap gap-3 pt-4 sm:pt-5 px-4 sm:px-5 pb-1">
              {filePreviews.map((preview, i) => (
                <div key={i} className="relative group animate-fade-in">
                  {preview.isImage ? (
                    /* eslint-disable-next-line @next/next/no-img-element -- Blob preview URLs cannot be optimized by next/image. */
                    <img
                      src={preview.url!}
                      alt=""
                      className="w-14 h-14 sm:w-20 sm:h-20 object-cover rounded-xl border border-black/5 dark:border-white/10 shadow-sm"
                    />
                  ) : (
                    <div className="w-14 h-14 sm:w-20 sm:h-20 bg-neutral-100 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/10 shadow-sm flex flex-col items-center justify-center p-2 text-center overflow-hidden">
                      <span className="text-[10px] sm:text-xs font-medium text-neutral-600 dark:text-neutral-300 truncate w-full">{preview.file.name}</span>
                      <span className="text-[9px] sm:text-[10px] text-neutral-400 dark:text-neutral-500 mt-1 uppercase">{preview.file.name.split('.').pop()}</span>
                    </div>
                  )}
                  <button
                    onClick={() => removeFile(i)}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-neutral-800/80 hover:bg-neutral-900 text-white grid place-items-center opacity-0 group-hover:opacity-100 transition-all active:scale-90 backdrop-blur-md shadow-sm"
                    title="Remove file"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            title="Upload image"
            placeholder="Upload image"
            aria-label="Upload image"
            accept="image/*,application/pdf"
            multiple
            onChange={handleFiles}
            className="hidden"
          />

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={isDragging ? "Drop images here..." : (placeholder || "Reply to Kaori")}
            rows={1}
            className={`w-full resize-none bg-transparent text-[15px] text-on-surface placeholder:text-secondary outline-none px-4 sm:px-5 pb-2 min-h-[54px] max-h-[180px] leading-relaxed font-body disabled:cursor-not-allowed disabled:opacity-70 caret-[hsl(var(--primary))] transition-[height] duration-500 ease-[cubic-bezier(0.2,1.2,0.4,1)] will-change-[height] ${filePreviews.length > 0 ? "pt-2" : "pt-4 sm:pt-5"}`}
            disabled={disabled}
          />

          {/* Bottom Toolbar */}
          <div className="flex items-center justify-between gap-1 sm:gap-2 px-2 sm:px-3 pb-2 sm:pb-3 w-full flex-wrap">
            {/* Left: attach + model */}
            <div className="flex items-center gap-1 min-w-0 flex-1">
              <button
                onClick={() => fileRef.current?.click()}
                className="h-10 w-10 shrink-0 grid place-items-center rounded-[1.25rem] text-secondary hover:text-on-surface hover:bg-white/60 dark:hover:bg-white/10 hover-lift active-press"
                title="Attach file"
              >
                <Plus size={20} strokeWidth={1.5} />
              </button>

              <div className="relative z-10 min-w-0 ml-1 max-w-[calc(100vw-7.5rem)] sm:max-w-none">
                <ModelSelector
                  model={model}
                  onChange={onModelChange}
                  direction="up"
                  minimal
                />
              </div>
            </div>

            {/* Right: voice + send */}
            <div className="flex items-center gap-1 shrink-0 ml-auto self-end sm:self-auto">
              <div ref={langMenuRef} className="relative hidden sm:block mr-1 z-20">
                <button
                  onClick={() => setShowLangMenu(!showLangMenu)}
                  className="flex min-w-0 items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium text-secondary hover:text-on-surface hover:bg-white/55 dark:hover:bg-white/10 transition-all duration-200 active:scale-95"
                  title="Voice Language"
                >
                  <Globe size={13} className="text-secondary shrink-0" />
                  <span className="truncate w-14 text-left">
                    {VOICE_LANGUAGES.find((l) => l.value === voiceLang)?.label || "Auto"}
                  </span>
                  <ChevronDown size={11} className={`shrink-0 transition-transform ${showLangMenu ? "rotate-180" : ""}`} />
                </button>

                {showLangMenu && (
                  <div className="absolute bottom-full right-0 mb-2 w-36 max-h-[16rem] rounded-2xl border border-white/70 dark:border-white/10 bg-white/90 dark:bg-neutral-950/92 backdrop-blur-md backdrop-saturate-150 shadow-2xl overflow-y-auto animate-fade-in p-1">
                    {VOICE_LANGUAGES.map((lang) => (
                      <button
                        key={lang.value}
                        onClick={() => {
                          handleVoiceLangChange(lang.value);
                          setShowLangMenu(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs font-medium rounded-xl flex items-center justify-between hover:bg-white/65 dark:hover:bg-white/10 transition-colors ${
                          voiceLang === lang.value ? "text-primary bg-[hsl(var(--primary)/0.08)]" : "text-on-surface"
                        }`}
                      >
                        {lang.label}
                        {voiceLang === lang.value && <Check size={12} className="text-primary" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={startVoice}
                className={`h-10 w-10 shrink-0 grid place-items-center rounded-[1.25rem] hover-lift active-press ${listening
                    ? "text-red-400 bg-red-400/10 animate-pulse"
                    : "text-secondary hover:text-on-surface hover:bg-white/60 dark:hover:bg-white/10"
                  }`}
                title="Voice input"
              >
                <Mic size={18} strokeWidth={1.5} />
              </button>
              <button
                onClick={toggleVoiceMode}
                className={`h-10 w-10 shrink-0 grid place-items-center rounded-[1.25rem] hover-lift active-press ${voiceMode
                    ? "text-green-400 bg-green-400/10 animate-pulse"
                    : "text-secondary hover:text-on-surface hover:bg-white/60 dark:hover:bg-white/10"
                  }`}
                title={voiceMode ? "Stop voice mode" : "Voice mode (continuous)"}
              >
                <AudioLines size={18} strokeWidth={1.5} />
              </button>

              <div className="w-px h-6 bg-white/40 dark:bg-white/10 mx-1" />

              {disabled ? (
                <button
                  onClick={onStop}
                  className="h-10 w-10 shrink-0 grid place-items-center rounded-[1.25rem] bg-white/55 dark:bg-white/10 text-secondary hover-lift active-press"
                  title="Stop generating"
                >
                  <Square size={14} className="fill-current" />
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={disabled || (!value.trim() && !files.length)}
                  className={`h-10 w-10 shrink-0 grid place-items-center rounded-[1.25rem] transition-all duration-300 ${(!value.trim() && !files.length) || disabled
                      ? "bg-neutral-200 dark:bg-white/5 text-secondary/50 cursor-not-allowed"
                      : "bg-primary text-white shadow-sm hover-lift active-press animate-breathe"
                    }`}
                  title="Send message"
                >
                  <ArrowUp size={18} strokeWidth={(!value.trim() && !files.length) || disabled ? 2 : 2.5} />
                </button>
              )}
            </div>
          </div>
        </div>

        <p className="text-[11px] text-center text-secondary mt-3 sm:mt-4 font-light tracking-wide px-3">
          Kaori can make mistakes. Please verify important information.
        </p>
      </div>
    </div>
  );
}
