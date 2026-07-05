"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, ArrowUp, Square, Mic, AudioLines, X } from "lucide-react";
import ModelSelector from "./model-selector";

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
  const [isDragging, setIsDragging] = useState(false);
  const [isJerking, setIsJerking] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const previewUrls = useMemo(
    () => files.filter((f) => f.type.startsWith("image/")).map((f) => URL.createObjectURL(f)),
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
    return () => previewUrls.forEach((url) => URL.revokeObjectURL(url));
  }, [previewUrls]);

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
    const imageFiles = selected.filter((f) => f.type.startsWith("image/"));
    setFiles((prev) => [...prev, ...imageFiles].slice(0, 3));
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
      if (items[i].type.startsWith("image/")) {
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
    const droppedFiles = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
    if (droppedFiles.length > 0) {
      setFiles((prev) => [...prev, ...droppedFiles].slice(0, 3));
    }
  };

  const startVoice = () => {
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
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
          {previewUrls.length > 0 && (
            <div className="flex flex-wrap gap-3 pt-4 sm:pt-5 px-4 sm:px-5 pb-1">
              {previewUrls.map((url, i) => (
                <div key={i} className="relative group animate-fade-in">
                  {/* eslint-disable-next-line @next/next/no-img-element -- Blob preview URLs cannot be optimized by next/image. */}
                  <img
                    src={url}
                    alt=""
                    className="w-14 h-14 sm:w-20 sm:h-20 object-cover rounded-xl border border-black/5 dark:border-white/10 shadow-sm"
                  />
                  <button
                    onClick={() => removeFile(i)}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-neutral-800/80 hover:bg-neutral-900 text-white grid place-items-center opacity-0 group-hover:opacity-100 transition-all active:scale-90 backdrop-blur-md shadow-sm"
                    title="Remove image"
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
            accept="image/*"
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
            className={`w-full resize-none bg-transparent text-[15px] text-on-surface placeholder:text-secondary outline-none px-4 sm:px-5 pb-2 min-h-[54px] max-h-[180px] leading-relaxed font-body disabled:cursor-not-allowed disabled:opacity-70 caret-[hsl(var(--primary))] transition-[height] duration-500 ease-[cubic-bezier(0.2,1.2,0.4,1)] will-change-[height] ${previewUrls.length > 0 ? "pt-2" : "pt-4 sm:pt-5"}`}
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
              <button
                onClick={startVoice}
                className={`h-10 w-10 shrink-0 grid place-items-center rounded-[1.25rem] hover-lift active-press ${
                  listening
                    ? "text-red-400 bg-red-400/10 animate-pulse"
                    : "text-secondary hover:text-on-surface hover:bg-white/60 dark:hover:bg-white/10"
                }`}
                title="Voice input"
              >
                <Mic size={18} strokeWidth={1.5} />
              </button>
              <button
                className="h-10 w-10 shrink-0 grid place-items-center rounded-[1.25rem] text-secondary hover:text-on-surface hover:bg-white/60 dark:hover:bg-white/10 hover-lift active-press"
                title="Voice mode"
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
                  className={`h-10 w-10 shrink-0 grid place-items-center rounded-[1.25rem] transition-all duration-300 ${
                    (!value.trim() && !files.length) || disabled
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
