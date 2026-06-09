import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();
    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    // Use DuckDuckGo HTML search (no API key needed)
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const resp = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    const html = await resp.text();

    // Parse results from DuckDuckGo HTML
    const results: { title: string; url: string; snippet: string }[] = [];
    const resultRegex = /<a rel="nofollow" class="result__a" href="([^"]*)"[^>]*>(.*?)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>(.*?)<\/a>/g;

    let match;
    while ((match = resultRegex.exec(html)) !== null && results.length < 8) {
      const url = decodeURIComponent(match[1].replace(/\/\/duckduckgo\.com\/l\/\?uddg=/, "").split("&")[0]);
      const title = match[2].replace(/<[^>]*>/g, "").trim();
      const snippet = match[3].replace(/<[^>]*>/g, "").trim();

      if (title && url && !url.includes("duckduckgo.com")) {
        results.push({ title, url, snippet });
      }
    }

    // Fallback: if regex didn't match, try simpler parsing
    if (results.length === 0) {
      const simpleRegex = /<a[^>]*class="result__url"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/g;
      while ((match = simpleRegex.exec(html)) !== null && results.length < 5) {
        results.push({
          title: match[2].trim(),
          url: match[1].trim(),
          snippet: "No snippet available",
        });
      }
    }

    return NextResponse.json({
      query,
      results,
      resultCount: results.length,
    });
  } catch (err) {
    console.error("Web search error:", err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
