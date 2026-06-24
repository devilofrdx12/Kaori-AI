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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const previewUrls = useMemo(
    () => files.filter((f) => f.type.startsWith("image/")).map((f) => URL.createObjectURL(f)),
    [files]
  );

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = Math.min(el.scrollHeight, 180) + "px";
  }, [value]);

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
      e.preventDefault();
      if (!disabled) handleSend();
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
    <div className="shrink-0 px-3 sm:px-4 pb-3 sm:pb-4 pt-2">
      <div className="max-w-3xl mx-auto">
        {/* File previews */}
        {previewUrls.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2 px-1">
            {previewUrls.map((url, i) => (
              <div key={i} className="relative group">
                {/* eslint-disable-next-line @next/next/no-img-element -- Blob preview URLs cannot be optimized by next/image. */}
                <img
                  src={url}
                  alt=""
                  className="w-16 h-16 object-cover rounded-[1.25rem] border border-white/70 dark:border-white/10 shadow-sm"
                />
                <button
                  onClick={() => removeFile(i)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-neutral-900 text-white grid place-items-center opacity-0 group-hover:opacity-100 transition-all active:scale-90"
                  title="Remove image"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input Container */}
        <div className="flex flex-col glass-panel rounded-[1.5rem] input-glow relative z-10">
          
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
            placeholder={placeholder || "Reply to Kaori"}
            rows={1}
            className="flex-1 w-full resize-none bg-transparent text-[15px] text-on-surface placeholder:text-secondary outline-none px-4 sm:px-5 pt-4 sm:pt-5 pb-2 min-h-[54px] max-h-[180px] leading-relaxed font-body disabled:cursor-not-allowed disabled:opacity-70"
            disabled={disabled}
          />

          {/* Bottom Toolbar */}
          <div className="flex items-center justify-between gap-1 sm:gap-2 px-2 sm:px-3 pb-2 sm:pb-3 w-full">
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
            <div className="flex items-center gap-1 shrink-0 self-end sm:self-auto">
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
                  className="h-10 w-10 shrink-0 grid place-items-center rounded-[1.25rem] bg-primary text-white shadow-sm hover-lift active-press disabled:opacity-50 disabled:cursor-not-allowed disabled:hover-lift-none disabled:active-press-none"
                  title="Send message"
                >
                  <ArrowUp size={18} strokeWidth={2.5} />
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
