"use client";

import { useState } from "react";
import Image from "next/image";
import { Globe, ExternalLink, FileText, ChevronDown, Check } from "lucide-react";

type ToolResultProps = {
  toolName: string;
  result: string;
};

type SearchImage = { url: string; alt: string };

const IMAGE_MARKER = "KAORI_SEARCH_IMAGES_JSON:";

function parseSearchResult(result: string): { text: string; images: SearchImage[] } {
  const markerIndex = result.lastIndexOf(IMAGE_MARKER);
  if (markerIndex < 0) return { text: result, images: [] };

  const text = result.slice(0, markerIndex).trim();
  try {
    const parsed = JSON.parse(result.slice(markerIndex + IMAGE_MARKER.length).trim());
    if (!Array.isArray(parsed)) return { text, images: [] };
    const images = parsed.filter(
      (image): image is SearchImage =>
        image !== null &&
        typeof image === "object" &&
        typeof image.url === "string" &&
        /^https?:\/\//i.test(image.url) &&
        typeof image.alt === "string"
    ).slice(0, 6);
    return { text, images };
  } catch {
    return { text, images: [] };
  }
}

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

/** Extracts source URLs from the web search result text */
function extractSourceUrls(text: string): { title: string; url: string }[] {
  const sources: { title: string; url: string }[] = [];
  // Match patterns like [Title](url) or SOURCE: url or urls on their own lines
  const urlRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let match;
  while ((match = urlRegex.exec(text)) !== null) {
    sources.push({ title: match[1], url: match[2] });
  }
  // Also try bare URLs with titles from "Source: title - url" patterns
  if (sources.length === 0) {
    const bareUrlRegex = /(https?:\/\/[^\s]+)/g;
    while ((match = bareUrlRegex.exec(text)) !== null) {
      try {
        const hostname = new URL(match[1]).hostname.replace(/^www\./, "");
        sources.push({ title: hostname, url: match[1] });
      } catch { /* skip invalid urls */ }
    }
  }
  // Deduplicate by URL
  const seen = new Set<string>();
  return sources.filter(s => {
    if (seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  }).slice(0, 5);
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
