export type SearchImage = { url: string; alt: string };

const IMAGE_MARKER = "KAORI_SEARCH_IMAGES_JSON:";

export function parseSearchResult(result: string): { text: string; images: SearchImage[] } {
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

/** Extracts source URLs from the web search result text */
export function extractSourceUrls(text: string): { title: string; url: string }[] {
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
