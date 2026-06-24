"use client";

import { useState } from "react";
import { Copy, Check, Terminal } from "lucide-react";

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
  const codeString = extractText(children).replace(/\n$/, "");
  const match = /language-(\w+)/.exec(className || "");
  const language = match ? match[1] : "code";
  const isInline = !className;

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
      <code className="bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded-lg text-[13px] font-mono text-neutral-800 dark:text-neutral-200 border border-black/5 dark:border-white/5 shadow-sm">
        {children as React.ReactNode}
      </code>
    );
  }

  return (
    <div className="not-prose group relative my-5 sm:my-6 w-full max-w-full rounded-[1.5rem] sm:rounded-[1.75rem] glass-panel bg-white/40 dark:bg-[#0d1117]/70 overflow-hidden transition-all duration-300 border-white/40 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.03)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.15)]">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg glass-panel flex items-center justify-center bg-white/60 dark:bg-white/10 border-white/50 dark:border-white/5 shadow-sm">
            <Terminal size={14} className="text-secondary dark:text-neutral-400" />
          </div>
          <span className="text-xs uppercase tracking-widest font-semibold font-headline text-neutral-500 dark:text-neutral-400 select-none">
            {language}
          </span>
        </div>

        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-panel bg-white/60 dark:bg-white/5 hover:bg-white/90 dark:hover:bg-white/15 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition-all hover-lift active-press shadow-sm"
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
      <pre className="!bg-transparent !m-0 !p-4 sm:!p-5 !border-none !shadow-none !rounded-none overflow-x-auto text-[13px] sm:text-sm leading-[1.65] font-body text-neutral-900 dark:text-neutral-200">
        <code className={`${className} hljs font-mono`} style={{ background: 'transparent', padding: 0 }}>
          {children as React.ReactNode}
        </code>
      </pre>
    </div>
  );
}
