import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "../../lib/auth-utils";
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

  try {
    const remoteUrl = await assertPublicHttpUrl(req.nextUrl.searchParams.get("url"));
    const response = await fetchPublicHttpUrl(remoteUrl, {
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
    const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    return new NextResponse(body, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Unable to load image" }, { status: 400 });
  }
}
