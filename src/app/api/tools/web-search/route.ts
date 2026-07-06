import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAjax } from "../../lib/auth-utils";
import { validateSearchQuery } from "../../lib/validation";

function decodeHtml(value: string): string {
  let decoded = value
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

    const html = await resp.text();
    const results: { title: string; url: string; snippet: string }[] = [];
    const resultRegex =
      /<a rel="nofollow" class="result__a" href="([^"]*)"[^>]*>(.*?)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>(.*?)<\/a>/g;

    let match;
    while ((match = resultRegex.exec(html)) !== null && results.length < 8) {
      const url = decodeURIComponent(
        match[1].replace(/\/\/duckduckgo\.com\/l\/\?uddg=/, "").split("&")[0]
      );
      const title = decodeHtml(match[2]);
      const snippet = decodeHtml(match[3]);

      if (title && url) {
        try {
          const parsedUrl = new URL(url);
          const hostname = parsedUrl.hostname;
          if (hostname !== "duckduckgo.com" && !hostname.endsWith(".duckduckgo.com")) {
            results.push({ title, url, snippet });
          }
        } catch {
          // Invalid URL, skip
        }
      }
    }

    return NextResponse.json({
      query: validatedQuery,
      results,
      resultCount: results.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Search failed" },
      { status: 400 }
    );
  }
}
