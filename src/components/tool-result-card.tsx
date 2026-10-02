"use client";

import { useState } from "react";
import Image from "next/image";
import { Globe, ExternalLink, FileText, ChevronDown, Check } from "lucide-react";

type ToolResultProps = {
  toolName: string;
  result: string;
};

import { parseSearchResult, extractSourceUrls, type SearchImage } from "@/lib/utils";



function SearchResultImage({ image }: { image: SearchImage }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  return (
    <a href={image.url} target="_blank" rel="noreferrer" className="relative block aspect-video overflow-hidden rounded-lg bg-black/5 dark:bg-white/5">
      <Image
        unoptimized
        src={`/api/tools/image-proxy?url=${encodeURIComponent(image.url)}`}
        alt={image.alt}
        fill
        sizes="(max-width: 640px) 50vw, 180px"
        className="object-cover transition-transform hover:scale-105"
        onError={() => setFailed(true)}
      />
    </a>
  );
}



function WebSearchResultCard({ result }: { result: string }) {
  const [expanded, setExpanded] = useState(false);
  const parsedResult = parseSearchResult(result);
  const sources = extractSourceUrls(parsedResult.text);

  return (
    <div className="my-2 animate-fade-in">
      {/* Pill — matches ThinkingIndicator layout exactly */}
      <button
        onClick={() => setExpanded((o) => !o)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-white/70 dark:border-white/10 shadow-sm bg-[hsl(var(--muted))] hover:bg-[hsl(var(--muted)/0.8)] transition-all duration-300 cursor-pointer select-none"
      >
        {/* Globe + check icon */}
        <div className="relative shrink-0">
          <Globe size={14} className="text-[hsl(var(--primary))]" />
          <Check
            size={8}
            strokeWidth={3}
            className="absolute -bottom-0.5 -right-1 text-green-500"
          />
        </div>

        {/* Label — same text-sm as ThinkingIndicator */}
        <span className="text-sm text-[hsl(var(--muted-foreground))]">
          Searched the web
        </span>

        {/* Source count badge */}
        {sources.length > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] text-[10px] font-semibold">
            {sources.length} source{sources.length !== 1 ? "s" : ""}
          </span>
        )}

        {/* Chevron */}
        <ChevronDown
          size={13}
          className={`shrink-0 ml-1 text-[hsl(var(--muted-foreground)/0.5)] transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {/* Expandable content */}
      <div
        className={`
          overflow-hidden transition-all duration-300 ease-out
          ${expanded ? "max-h-[500px] opacity-100 mt-2" : "max-h-0 opacity-0 mt-0"}
        `}
      >
        <div className="ml-5 pl-3 border-l-2 border-[hsl(var(--primary)/0.2)]">
          {/* Source links */}
          {sources.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {sources.map((source, i) => (
                <a
                  key={i}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/60 dark:bg-white/5 border border-black/5 dark:border-white/10 text-[11px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] hover:border-[hsl(var(--primary)/0.3)] transition-colors"
                >
                  <Globe size={10} className="shrink-0 opacity-60" />
                  <span className="truncate max-w-[160px]">{source.title}</span>
                  <ExternalLink size={9} className="shrink-0 opacity-40" />
                </a>
              ))}
            </div>
          )}

          {/* Search result images */}
          {parsedResult.images.length > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 mb-2">
              {parsedResult.images.map((image) => (
                <SearchResultImage key={image.url} image={image} />
              ))}
            </div>
          )}

          {/* Raw result text (truncated) */}
          <div className="max-h-40 overflow-y-auto scrollbar-hide rounded-lg p-2.5 bg-[hsl(var(--muted)/0.3)]">
            <p className="text-[11px] leading-relaxed text-[hsl(var(--muted-foreground)/0.8)] whitespace-pre-wrap break-words">
              {parsedResult.text.length > 800
                ? parsedResult.text.slice(0, 800) + "…"
                : parsedResult.text}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ToolResultCard({ toolName, result }: ToolResultProps) {
  // Web search gets special minimal treatment
  if (toolName === "web_search") {
    return <WebSearchResultCard result={result} />;
  }

  const icon =
    toolName === "web_fetch" ? (
      <FileText size={14} className="text-green-400" />
    ) : (
      <ExternalLink size={14} className="text-[hsl(var(--primary))]" />
    );

  const label =
    toolName === "web_fetch"
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
