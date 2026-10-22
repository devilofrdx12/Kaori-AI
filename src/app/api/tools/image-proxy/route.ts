import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "../../lib/auth-utils";
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
const ALLOWED_IMAGE_HOSTS = new Set([
  "avatars.githubusercontent.com",
  "lh3.googleusercontent.com",
  "cdn.discordapp.com",
]);

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const validated = await assertPublicHttpUrl(req.nextUrl.searchParams.get("url"));
    
    // Explicit local allowlist check to break "arbitrary user URL" pattern
    if (!ALLOWED_IMAGE_HOSTS.has(validated.hostname)) {
      return NextResponse.json({ error: "Host not allowed" }, { status: 403 });
    }

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
