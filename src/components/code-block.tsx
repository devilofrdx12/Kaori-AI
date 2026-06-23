"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

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
      <code className="bg-[hsl(var(--muted))] px-1.5 py-0.5 rounded text-sm font-mono">
        {children as React.ReactNode}
      </code>
    );
  }

  return (
    <div className="my-4 max-w-full rounded-xl overflow-hidden border border-[hsl(var(--border))] bg-[#0d1117] shadow-lg">
      <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] text-xs text-neutral-400">
        <span className="uppercase tracking-wider font-medium">{language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 hover:text-white transition-all active:scale-95"
        >
          {copied ? (
            <>
              <Check size={14} className="text-green-400" />
              <span className="text-green-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy size={14} />
              Copy
            </>
          )}
        </button>
      </div>
      <pre className="p-4 max-w-full overflow-x-auto text-sm leading-relaxed bg-[#0d1117]">
        <code className={`${className} hljs font-mono`} style={{ background: 'transparent', padding: 0 }}>{children as React.ReactNode}</code>
      </pre>
    </div>
  );
}
