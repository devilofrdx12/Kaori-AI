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
  const resultBlockRegex = /<div[^>]+class="[^"]*\bresult\b[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]+class="[^"]*\bresult\b[^"]*"|<\/body>|$)/gi;

  let blockMatch;
  while ((blockMatch = resultBlockRegex.exec(html)) !== null && results.length < 8) {
    const block = blockMatch[1];
    const linkMatch = block.match(/<a[^>]+class="[^"]*\bresult__a\b[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!linkMatch) continue;

    const url = unwrapDuckDuckGoUrl(linkMatch[1]);
    const title = decodeHtml(linkMatch[2]);
    const snippetMatch = block.match(/<[^>]+class="[^"]*\bresult__snippet\b[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/i);
    const snippet = snippetMatch ? decodeHtml(snippetMatch[1]) : "";

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

    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(
      validatedQuery
    )}`;
    const resp = await fetch(searchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
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
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    const safeMessages = new Set(["Query is required", "Query too long (max 300 characters)"]);
    return NextResponse.json(
      { error: safeMessages.has(message) ? message : "Search failed" },
      { status: 400 }
    );
  }
}
