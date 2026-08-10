import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAjax } from "../../lib/auth-utils";
import { validateSearchQuery } from "../../lib/validation";
import { readResponseTextWithLimit } from "../../lib/url-safety";
import { checkToolRateLimit } from "../../lib/rate-limit";

const MAX_SEARCH_RESPONSE_BYTES = 1 * 1024 * 1024;

type SearchImage = { url: string; alt: string };
type SearchTopic = "general" | "news" | "finance";
type SearchTimeRange = "day" | "week" | "month" | "year";
type SourceTier = "primary" | "wire" | "established" | "standard";

const WIRE_DOMAINS = new Set(["apnews.com", "reuters.com"]);
const ESTABLISHED_DOMAINS = new Set([
  "bbc.com", "bbc.co.uk", "theguardian.com", "nytimes.com", "washingtonpost.com",
  "ft.com", "bloomberg.com", "economist.com", "aljazeera.com", "dw.com",
  "france24.com", "cnn.com", "cnbc.com", "npr.org", "pbs.org", "axios.com",
]);

function classifySource(rawUrl: string): SourceTier {
  try {
    const hostname = new URL(rawUrl).hostname.toLowerCase().replace(/^www\./, "");
    if (
      hostname.endsWith(".gov") || hostname.includes(".gov.") || hostname.endsWith(".mil") ||
      hostname === "un.org" || hostname.endsWith(".un.org") || hostname === "who.int" ||
      hostname === "europa.eu" || hostname.endsWith(".europa.eu") || hostname === "icc-cricket.com"
    ) return "primary";
    if (WIRE_DOMAINS.has(hostname) || [...WIRE_DOMAINS].some((domain) => hostname.endsWith(`.${domain}`))) return "wire";
    if (ESTABLISHED_DOMAINS.has(hostname) || [...ESTABLISHED_DOMAINS].some((domain) => hostname.endsWith(`.${domain}`))) return "established";
    return "standard";
  } catch {
    return "standard";
  }
}

function authorityBonus(tier: SourceTier): number {
  if (tier === "primary") return 0.12;
  if (tier === "wire") return 0.1;
  if (tier === "established") return 0.05;
  return 0;
}

function inferSearchTopic(query: string, requested: unknown): SearchTopic {
  if (requested === "general" || requested === "news" || requested === "finance") return requested;
  if (/\b(stock|stocks|share price|earnings|market cap|dividend|nasdaq|nyse|crypto|bitcoin|forex|financial results)\b/i.test(query)) {
    return "finance";
  }
  if (/\b(latest|breaking|today|tonight|yesterday|this week|current events?|news|score|election|announced)\b/i.test(query)) {
    return "news";
  }
  return "general";
}

function inferTimeRange(query: string, requested: unknown): SearchTimeRange | undefined {
  if (requested === "day" || requested === "week" || requested === "month" || requested === "year") return requested;
  if (/\b(today|tonight|yesterday|past 24 hours?|last 24 hours?|breaking)\b/i.test(query)) return "day";
  if (/\b(this week|past week|last week|latest news)\b/i.test(query)) return "week";
  if (/\b(this month|past month|last month)\b/i.test(query)) return "month";
  if (/\b(this year|past year|last year)\b/i.test(query)) return "year";
  return undefined;
}

function normalizeSearchImages(value: unknown): SearchImage[] {
  if (!Array.isArray(value)) return [];

  const images: SearchImage[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const rawUrl = typeof item === "string" ? item : (item as { url?: unknown })?.url;
    const rawAlt = typeof item === "object" && item !== null
      ? (item as { description?: unknown }).description
      : undefined;
    if (typeof rawUrl !== "string" || seen.has(rawUrl)) continue;

    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") continue;
      seen.add(rawUrl);
      images.push({
        url: parsed.toString(),
        alt: typeof rawAlt === "string" && rawAlt.trim() ? rawAlt.trim().slice(0, 160) : "Search result image",
      });
      if (images.length === 6) break;
    } catch {
      // Ignore malformed or unsupported image URLs.
    }
  }
  return images;
}

function decodeHtml(value: string): string {
  let decoded = value
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

  let previous;
  do {
    previous = decoded;
    decoded = decoded.replace(/<[^>]*>/g, "");
  } while (decoded !== previous);

  return decoded.trim();
}

function unwrapDuckDuckGoUrl(rawUrl: string): string {
  const decoded = decodeURIComponent(rawUrl.replace(/^\/\//, "https://"));

  try {
    const parsed = new URL(decoded);
    const wrappedUrl = parsed.searchParams.get("uddg");
    if (wrappedUrl) return decodeURIComponent(wrappedUrl);
    return parsed.toString();
  } catch {
    return decoded;
  }
}

function extractSearchResults(html: string) {
  const results: { title: string; url: string; snippet: string }[] = [];
  const seen = new Set<string>();
  
  // DDG Lite uses a table structure where links and snippets are in separate rows
  const linkRegex = /<a[^>]+class=['"][^'"]*\bresult-link\b[^'"]*['"][^>]*>([\s\S]*?)<\/a>/gi;
  const snippetRegex = /<td[^>]+class=['"][^'"]*\bresult-snippet\b[^'"]*['"][^>]*>([\s\S]*?)<\/td>/gi;

  const links = [...html.matchAll(linkRegex)];
  const snippets = [...html.matchAll(snippetRegex)];

  for (let i = 0; i < links.length && i < snippets.length && results.length < 8; i++) {
    const linkTagMatch = links[i][0];
    const hrefMatch = linkTagMatch.match(/href=['"]([^'"]+)['"]/i);
    
    const url = hrefMatch ? unwrapDuckDuckGoUrl(hrefMatch[1]) : "";
    const title = decodeHtml(links[i][1]);
    const snippet = decodeHtml(snippets[i][1]);

    if (!title || !url || seen.has(url)) continue;

    try {
      const parsedUrl = new URL(url);
      const hostname = parsedUrl.hostname;
      if (hostname === "duckduckgo.com" || hostname.endsWith(".duckduckgo.com")) continue;

      seen.add(url);
      results.push({ title, url, snippet });
    } catch {
      // Invalid URL, skip
    }
  }

  return results;
}

export async function POST(req: NextRequest) {
  try {
    requireAjax(req);
  } catch (err) {
    if (err instanceof Response) return err;
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateCheck = await checkToolRateLimit(user.id, user.is_pro);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Tool rate limit reached. Please try again shortly.", retryAfterSec: rateCheck.retryAfterSec },
      { status: 429 }
    );
  }

  try {
    const { query, queries, topic: requestedTopic, time_range: requestedTimeRange } = await req.json().catch(() => ({}));
    const validatedQuery = validateSearchQuery(query);
    const queryList = [
      validatedQuery,
      ...(Array.isArray(queries) ? queries.slice(0, 3).map(validateSearchQuery) : []),
    ].filter((value, index, all) => all.findIndex((candidate) => candidate.toLowerCase() === value.toLowerCase()) === index)
      .slice(0, 3);
    const topic = inferSearchTopic(validatedQuery, requestedTopic);
    const timeRange = inferTimeRange(validatedQuery, requestedTimeRange);

    const tavilyApiKey = process.env.TAVILY_API_KEY;

    if (tavilyApiKey) {
      // Use Tavily Search API
      const responses = await Promise.allSettled(queryList.map(async (searchQuery) => {
        const resp = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: tavilyApiKey,
            query: searchQuery,
            search_depth: "advanced",
            chunks_per_source: 3,
            topic: inferSearchTopic(searchQuery, requestedTopic),
            ...(timeRange ? { time_range: timeRange } : {}),
            include_answer: false,
            include_images: true,
            include_image_descriptions: true,
            include_raw_content: false,
            include_favicon: true,
            max_results: queryList.length > 1 ? 6 : 10,
          }),
          signal: AbortSignal.timeout(18000),
        });
        if (!resp.ok) return null;
        return { searchQuery, data: await resp.json() };
      }));

      const successfulResponses = responses.flatMap((response) =>
        response.status === "fulfilled" && response.value !== null ? [response.value] : []
      );
      if (successfulResponses.length === 0) {
        return NextResponse.json({ error: "Search failed via Tavily API" }, { status: 502 });
      }

      const seen = new Set<string>();
      const results = successfulResponses.flatMap(({ searchQuery, data }) =>
        (Array.isArray(data.results) ? data.results : []).map((result: unknown) => ({ result, searchQuery })))
        .map((entry: { result: unknown; searchQuery: string }) => {
          const r = entry.result !== null && typeof entry.result === "object"
            ? entry.result as Record<string, unknown>
            : {};
          const url = typeof r.url === "string" ? r.url : "";
          const sourceTier = classifySource(url);
          const relevanceScore = typeof r.score === "number" ? r.score : undefined;
          let hostname = "";
          try {
            hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
          } catch {}
          return {
            title: typeof r.title === "string" ? r.title.trim() : "Untitled source",
            url,
            snippet: typeof r.content === "string" ? r.content.trim().slice(0, 1800) : "",
            score: relevanceScore,
            sourceTier,
            hostname,
            rankingScore: (relevanceScore ?? 0) + authorityBonus(sourceTier),
            publishedDate: typeof r.published_date === "string" ? r.published_date : undefined,
            favicon: typeof r.favicon === "string" ? r.favicon : undefined,
            sourceQuery: entry.searchQuery,
          };
        })
        .filter((result: { url: string; snippet: string }) => {
          if (!result.url || !result.snippet) return false;
          try {
            const canonical = new URL(result.url);
            canonical.hash = "";
            const key = canonical.toString();
            if (seen.has(key)) return false;
            seen.add(key);
            return canonical.protocol === "https:" || canonical.protocol === "http:";
          } catch {
            return false;
          }
        })
        .sort((a: { rankingScore: number }, b: { rankingScore: number }) => b.rankingScore - a.rankingScore)
        .filter((result, _index, allResults) =>
          allResults.filter((candidate) => candidate.hostname === result.hostname).indexOf(result) < 2)
        .slice(0, 8)
        .map((rankedResult) => {
          const result = { ...rankedResult };
          delete (result as Partial<typeof rankedResult>).rankingScore;
          return result;
        });

      return NextResponse.json({
        query: validatedQuery,
        queries: queryList,
        topic,
        timeRange,
        searchedAt: new Date().toISOString(),
        results,
        images: normalizeSearchImages(successfulResponses.flatMap(({ data }) => Array.isArray(data.images) ? data.images : [])),
        resultCount: results.length,
      });
    } else {
      // Fallback to DuckDuckGo Scraper (works locally, might fail on Vercel)
      const searchUrl = `https://lite.duckduckgo.com/lite/`;
      const resp = await fetch(searchUrl, {
        method: "POST",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `q=${encodeURIComponent(validatedQuery)}`,
        signal: AbortSignal.timeout(10000),
      });

      if (!resp.ok) {
        return NextResponse.json({ error: "Search failed" }, { status: 502 });
      }

      const html = await readResponseTextWithLimit(resp, MAX_SEARCH_RESPONSE_BYTES);
      const results = extractSearchResults(html);

      return NextResponse.json({
        query: validatedQuery,
        topic: "general",
        results,
        images: [],
        resultCount: results.length,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    const safeMessages = new Set(["Query is required", "Query too long (max 300 characters)"]);
    return NextResponse.json(
      { error: safeMessages.has(message) ? message : "Search failed" },
      { status: 400 }
    );
  }
}
