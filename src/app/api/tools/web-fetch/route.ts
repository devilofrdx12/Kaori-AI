import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAjax } from "../../lib/auth-utils";
import { assertPublicHttpUrl, fetchPublicHttpUrl } from "../../lib/url-safety";

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
    const { url } = await req.json().catch(() => ({}));
    const parsedUrl = await assertPublicHttpUrl(url);

    const resp = await fetchPublicHttpUrl(parsedUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!resp.ok) {
      return NextResponse.json(
        { error: `Failed to fetch: ${resp.status} ${resp.statusText}` },
        { status: 502 }
      );
    }

    const contentType = resp.headers.get("content-type") || "";
    if (!/^(text\/|application\/(xhtml\+xml|xml|json))/.test(contentType)) {
      return NextResponse.json(
        { error: "Only text-based web pages can be fetched" },
        { status: 415 }
      );
    }

    const html = await resp.text();

    let textContent = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[\s\S]*?<\/footer>/gi, "")
      .replace(/<header[\s\S]*?<\/header>/gi, "")
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();

    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    const title = titleMatch
      ? titleMatch[1].replace(/<[^>]*>/g, "").trim()
      : parsedUrl.hostname;

    const descMatch = html.match(
      /<meta[^>]*name=["']description["'][^>]*content=["'](.*?)["']/i
    );
    const description = descMatch ? descMatch[1] : "";

    if (textContent.length > 8000) {
      textContent = `${textContent.slice(0, 8000)}\n\n[Content truncated - page is very long]`;
    }

    return NextResponse.json({
      url: parsedUrl.toString(),
      title,
      description,
      content: textContent,
      contentType,
      contentLength: textContent.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Fetch failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
