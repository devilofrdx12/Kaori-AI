"use client";

import { Globe, ExternalLink, FileText } from "lucide-react";

type ToolResultProps = {
  toolName: string;
  result: string;
};

export default function ToolResultCard({ toolName, result }: ToolResultProps) {
  const icon =
    toolName === "web_search" ? (
      <Globe size={14} className="text-blue-400" />
    ) : toolName === "web_fetch" ? (
      <FileText size={14} className="text-green-400" />
    ) : (
      <ExternalLink size={14} className="text-[hsl(var(--primary))]" />
    );

  const label =
    toolName === "web_search"
      ? "Web Search"
      : toolName === "web_fetch"
      ? "Page Content"
      : toolName;

  return (
    <div className="tool-card px-3 py-2 my-2 text-xs bg-white/55 dark:bg-white/5">
      <div className="flex items-center gap-1.5 text-[hsl(var(--muted-foreground))] mb-1">
        {icon}
        <span className="font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-[hsl(var(--muted-foreground))] line-clamp-2">{result}</p>
    </div>
  );
}
