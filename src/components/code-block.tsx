"use client";

import { useState, useRef, useEffect } from "react";
import { Copy, Check, Terminal, Play, Code } from "lucide-react";

function extractText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(extractText).join("");
  if (value && typeof value === "object" && "props" in value) {
    const props = (value as { props?: { children?: unknown } }).props;
    if (props?.children) return extractText(props.children);
  }
  return "";
}

export default function CodeBlock({
  className,
  children,
}: {
  className?: string;
  children: unknown;
}) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"code" | "preview">("code");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const codeString = extractText(children).replace(/\n$/, "");
  const match = /language-(\w+)/.exec(className || "");
  const language = match ? match[1] : "code";
  const isInline = !className;

  const canPreview = language === "html" || language === "svg";

  useEffect(() => {
    if (activeTab === "preview" && iframeRef.current) {
      // Small adjustment to resize iframe based on content can be done here if needed,
      // but a fixed min-height is often sufficient and safer.
    }
  }, [activeTab]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  if (isInline) {
    return (
      <code className="bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded-lg text-[13px] font-mono text-neutral-800 dark:text-neutral-200 border border-black/5 dark:border-white/[0.08] shadow-sm">
        {children as React.ReactNode}
      </code>
    );
  }

  return (
    <div className="not-prose group relative my-5 sm:my-6 w-full max-w-full !rounded-[1.5rem] sm:!rounded-[1.75rem] overflow-hidden transition-all duration-300 glass-panel">
      {/* Header Bar */}
      <div className="relative flex items-center justify-between px-4 sm:px-5 py-3 border-b border-black/5 dark:border-white/[0.08] bg-black/[0.02] dark:bg-black/20">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/80 dark:bg-white/10 border border-black/5 dark:border-white/10 shadow-sm">
            <Terminal size={14} className="text-neutral-500 dark:text-neutral-400" />
          </div>
          {canPreview ? (
            <div className="flex bg-black/5 dark:bg-white/10 rounded-lg p-0.5 ml-1">
              <button
                onClick={() => setActiveTab("code")}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  activeTab === "code"
                    ? "bg-white dark:bg-black/40 text-neutral-900 dark:text-white shadow-sm"
                    : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
                }`}
              >
                <Code size={12} />
                Code
              </button>
              <button
                onClick={() => setActiveTab("preview")}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  activeTab === "preview"
                    ? "bg-white dark:bg-black/40 text-neutral-900 dark:text-white shadow-sm"
                    : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
                }`}
              >
                <Play size={12} />
                Preview
              </button>
            </div>
          ) : (
            <span className="text-xs uppercase tracking-widest font-semibold font-headline text-neutral-500 dark:text-neutral-400 select-none">
              {language}
            </span>
          )}
        </div>

        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 dark:bg-white/10 border border-black/5 dark:border-white/10 hover:bg-white dark:hover:bg-white/20 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition-all shadow-sm active-press hover-lift"
        >
          {copied ? (
            <>
              <Check size={14} className="text-green-500 dark:text-green-400" />
              <span className="text-green-600 dark:text-green-400">Copied</span>
            </>
          ) : (
            <>
              <Copy size={14} />
              Copy
            </>
          )}
        </button>
      </div>

      {/* Code Area */}
      {activeTab === "code" ? (
        <pre className="relative !bg-transparent !m-0 !p-4 sm:!p-5 !border-none !shadow-none !rounded-none overflow-x-auto text-[13px] sm:text-sm leading-[1.65] font-body text-neutral-900 dark:text-neutral-100">
          <code className={`${className} hljs font-mono !bg-transparent !p-0`}>
            {children as React.ReactNode}
          </code>
        </pre>
      ) : (
        <div className="relative w-full bg-white overflow-hidden min-h-[400px]">
          <iframe
            ref={iframeRef}
            title="Preview"
            srcDoc={codeString}
            sandbox="allow-scripts"
            referrerPolicy="no-referrer"
            className="w-full h-full min-h-[400px] border-none bg-white"
          />
        </div>
      )}
    </div>
  );
}
