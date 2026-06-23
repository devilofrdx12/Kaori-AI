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
    <div className="shrink-0 px-3 sm:px-4 pb-4 pt-2">
      <div className="max-w-3xl mx-auto">
        {/* File previews */}
        {previewUrls.length > 0 && (
          <div className="flex gap-2 mb-2 px-1">
            {previewUrls.map((url, i) => (
              <div key={i} className="relative group">
                {/* eslint-disable-next-line @next/next/no-img-element -- Blob preview URLs cannot be optimized by next/image. */}
                <img
                  src={url}
                  alt=""
                  className="w-16 h-16 object-cover rounded-lg border border-neutral-200 dark:border-neutral-800"
                />
                <button
                  onClick={() => removeFile(i)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-neutral-800 text-white grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove image"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input Container */}
        <div className="flex flex-col bg-white dark:bg-[#202020] rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm transition-all duration-300 focus-within:ring-4 focus-within:ring-[hsl(var(--primary)/0.15)] focus-within:border-[hsl(var(--primary)/0.4)] focus-within:shadow-md">
          
          <input
            ref={fileRef}
            type="file"
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
            className="flex-1 w-full resize-none bg-transparent text-[15px] text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 outline-none px-4 pt-4 pb-2 min-h-[56px] max-h-[180px] leading-relaxed"
            disabled={disabled}
          />

          {/* Bottom Toolbar */}
          <div className="flex items-center justify-between px-2 pb-2">
            {/* Left: attach + model */}
            <div className="flex items-center gap-1 min-w-0">
              <button
                onClick={() => fileRef.current?.click()}
                className="h-9 w-9 shrink-0 grid place-items-center rounded-lg text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/50 transition-colors"
                title="Attach file"
              >
                <Plus size={20} strokeWidth={1.5} />
              </button>

              <div className="relative z-10 min-w-0">
                <ModelSelector 
                  model={model} 
                  onChange={onModelChange} 
                  direction="up" 
                  minimal 
                />
              </div>
            </div>

            {/* Right: voice + send */}
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                onClick={startVoice}
                className={`h-8 w-8 shrink-0 grid place-items-center rounded-lg transition-colors ${
                  listening
                    ? "text-red-400 bg-red-400/10 animate-pulse"
                    : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/50"
                }`}
                title="Voice input"
              >
                <Mic size={18} strokeWidth={1.5} />
              </button>
              <button
                className="h-8 w-8 shrink-0 grid place-items-center rounded-lg text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/50 transition-colors"
                title="Voice mode"
              >
                <AudioLines size={18} strokeWidth={1.5} />
              </button>

              <div className="w-px h-5 bg-neutral-200 dark:bg-neutral-700 mx-1" />

              {disabled ? (
                <button
                  onClick={onStop}
                  className="h-8 w-8 shrink-0 grid place-items-center rounded-[10px] bg-neutral-200 dark:bg-neutral-800 text-neutral-500 hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-colors"
                  title="Stop generating"
                >
                  <Square size={14} className="fill-current" />
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!value.trim() && !files.length}
                  className="h-8 w-8 shrink-0 grid place-items-center rounded-[10px] bg-[#d96b41] text-white disabled:opacity-50 disabled:bg-neutral-200 dark:disabled:bg-neutral-800 disabled:text-neutral-400 dark:disabled:text-neutral-500 transition-colors"
                  title="Send message"
                >
                  <ArrowUp size={16} strokeWidth={2.5} />
                </button>
              )}
            </div>
          </div>
        </div>

        <p className="text-[11px] text-center text-neutral-400 dark:text-neutral-500 mt-3 font-medium">
          Kaori can make mistakes. Please verify important information.
        </p>
      </div>
    </div>
  );
}
