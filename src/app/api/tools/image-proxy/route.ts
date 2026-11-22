import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "../../lib/auth-utils";
import { checkToolRateLimit } from "../../lib/rate-limit";
import { logger } from "../../lib/logger";
import {
  assertPublicHttpUrl,
  fetchPublicHttpUrl,
  readResponseBytesWithLimit,
} from "../../lib/url-safety";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Rate limit image proxy requests to prevent scraping abuse
  const rateCheck = await checkToolRateLimit(user.id, user.is_pro === 1);
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: "Too many image requests" }, { status: 429 });
  }

  try {
    const rawUrl = req.nextUrl.searchParams.get("url");
    if (!rawUrl) {
      return NextResponse.json({ error: "Missing image url" }, { status: 400 });
    }

    // Comprehensive SSRF check: DNS pinning, IPv4/IPv6 private IP blocklist, protocol check
    const validated = await assertPublicHttpUrl(rawUrl);

    const response = await fetchPublicHttpUrl(validated, {
      headers: { Accept: "image/avif,image/webp,image/png,image/jpeg,image/gif" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) {
      return NextResponse.json({ error: "Image source failed" }, { status: 502 });
    }

    const contentType = (response.headers.get("content-type") || "")
      .split(";", 1)[0]
      .trim()
      .toLowerCase();
    if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
      return NextResponse.json({ error: "Unsupported image type" }, { status: 415 });
    }

    const bytes = await readResponseBytesWithLimit(response, MAX_IMAGE_BYTES);

    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    logger.warn({ err, route: "GET /api/tools/image-proxy" }, "Image proxy request failed");
    return NextResponse.json({ error: "Unable to load image" }, { status: 400 });
  }
}
