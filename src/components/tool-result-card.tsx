"use client";

import { useState } from "react";
import Image from "next/image";
import { Globe, ExternalLink, FileText } from "lucide-react";

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

export default function ToolResultCard({ toolName, result }: ToolResultProps) {
  const parsedResult = toolName === "web_search"
    ? parseSearchResult(result)
    : { text: result, images: [] };
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
      <p className="text-[hsl(var(--muted-foreground))] line-clamp-2">{parsedResult.text}</p>
      {parsedResult.images.length > 0 ? (
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {parsedResult.images.map((image) => (
            <SearchResultImage key={image.url} image={image} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
