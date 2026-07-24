import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAjax } from "../../lib/auth-utils";
import { validateSearchQuery } from "../../lib/validation";
import { readResponseTextWithLimit } from "../../lib/url-safety";
import { checkToolRateLimit } from "../../lib/rate-limit";

const MAX_SEARCH_RESPONSE_BYTES = 1 * 1024 * 1024;

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
    const { query } = await req.json().catch(() => ({}));
    const validatedQuery = validateSearchQuery(query);

    const tavilyApiKey = process.env.TAVILY_API_KEY;

    if (tavilyApiKey) {
      // Use Tavily Search API
      const resp = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          api_key: tavilyApiKey,
          query: validatedQuery,
          search_depth: "basic",
          include_answer: false,
          include_images: false,
          include_raw_content: false,
          max_results: 8,
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        return NextResponse.json({ error: errData.detail || "Search failed via Tavily API" }, { status: 502 });
      }

      const data = await resp.json();
      const results = (data.results || []).map((r: any) => ({
        title: r.title,
        url: r.url,
        snippet: r.content,
      }));

      return NextResponse.json({
        query: validatedQuery,
        results,
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
        results,
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
