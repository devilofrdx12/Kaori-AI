import { lookup } from "node:dns/promises";
import net from "node:net";
import type { Agent, RequestInit as UndiciRequestInit } from "undici";

const MAX_REDIRECTS = 3;

export function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return true;
  const [a, b] = parts;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // RFC 6598 CGNAT
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

function parseTrailingIpv4ToHextets(token: string): [number, number] | null {
  const parts = token.split(".");
  if (parts.length !== 4) return null;

  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const value = Number(part);
    if (value < 0 || value > 255 || String(value) !== part) return null;
    octets.push(value);
  }

  return [(octets[0] << 8) | octets[1], (octets[2] << 8) | octets[3]];
}

function parseIpv6Segment(tokens: string[], allowTrailingIpv4: boolean): number[] | null {
  const hextets: number[] = [];

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const isLast = i === tokens.length - 1;

    if (isLast && allowTrailingIpv4 && token.includes(".")) {
      const ipv4Hextets = parseTrailingIpv4ToHextets(token);
      if (!ipv4Hextets) return null;
      hextets.push(ipv4Hextets[0], ipv4Hextets[1]);
      continue;
    }

    if (!/^[0-9a-f]{1,4}$/.test(token)) return null;
    hextets.push(parseInt(token, 16));
  }

  return hextets;
}

function parseIpv6Hextets(rawIp: string): number[] | null {
  const ip = rawIp.trim().toLowerCase();
  if (!ip || ip.includes("%")) return null;

  const doubleColonParts = ip.split("::");
  if (doubleColonParts.length > 2) return null;

  if (doubleColonParts.length === 1) {
    const tokens = doubleColonParts[0].split(":");
    const hextets = parseIpv6Segment(tokens, true);
    return hextets && hextets.length === 8 ? hextets : null;
  }

  const [leftRaw, rightRaw] = doubleColonParts;
  const leftTokens = leftRaw ? leftRaw.split(":") : [];
  const rightTokens = rightRaw ? rightRaw.split(":") : [];

  const leftHextets = parseIpv6Segment(leftTokens, false);
  const rightHextets = parseIpv6Segment(rightTokens, rightTokens.length > 0);
  if (!leftHextets || !rightHextets) return null;

  const totalExplicit = leftHextets.length + rightHextets.length;
  if (totalExplicit >= 8) return null;

  const zeroCount = 8 - totalExplicit;
  return [...leftHextets, ...new Array<number>(zeroCount).fill(0), ...rightHextets];
}

function hextetsToIpv4(high: number, low: number): string {
  return `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`;
}

export function isPrivateIpv6(ip: string): boolean {
  const h = parseIpv6Hextets(ip);
  if (!h) return true;

  const [h0, h1, h2, h3, h4, h5, h6, h7] = h;

  // Unspecified ::/128 and Loopback ::1/128
  if (h.every((word) => word === 0)) return true;
  if (h0 === 0 && h1 === 0 && h2 === 0 && h3 === 0 && h4 === 0 && h5 === 0 && h6 === 0 && h7 === 1) {
    return true;
  }

  // IPv4-mapped ::ffff:0:0/96 and IPv4-compatible ::/96
  if (h0 === 0 && h1 === 0 && h2 === 0 && h3 === 0 && h4 === 0 && (h5 === 0xffff || h5 === 0)) {
    return isPrivateIpv4(hextetsToIpv4(h6, h7));
  }

  // Unique Local fc00::/7 (0xfc00..0xfdff)
  if ((h0 & 0xfe00) === 0xfc00) return true;

  // Link-Local fe80::/10 (0xfe80..0xfebf)
  if ((h0 & 0xffc0) === 0xfe80) return true;

  // Site-Local fec0::/10 (0xfec0..0xfeff)
  if ((h0 & 0xffc0) === 0xfec0) return true;

  // Multicast ff00::/8
  if ((h0 & 0xff00) === 0xff00) return true;

  // Teredo 2001:0000::/32, Benchmarking 2001:0002::/48, Documentation 2001:0db8::/32
  if (h0 === 0x2001 && (h1 === 0x0000 || h1 === 0x0db8 || (h1 === 0x0002 && h2 === 0x0000))) {
    return true;
  }

  // 6to4 2002::/16 (embedded IPv4 in words 1 & 2)
  if (h0 === 0x2002) {
    return isPrivateIpv4(hextetsToIpv4(h1, h2));
  }

  // NAT64 0064:ff9b::/96 and 0064:ff9b:0001::/48
  if (h0 === 0x0064 && h1 === 0xff9b) {
    if (h2 === 0 && h3 === 0 && h4 === 0 && h5 === 0) return true;
    if (h2 === 0x0001) return true;
  }

  return false;
}

export function isPrivateIp(ip: string): boolean {
  const version = net.isIP(ip);
  if (version === 4) return isPrivateIpv4(ip);
  if (version === 6) return isPrivateIpv6(ip);
  return true;
}

function isHostnameAllowed(hostname: string): boolean {
  const allowlistEnv = process.env.ALLOWED_FETCH_HOSTS;
  if (!allowlistEnv || !allowlistEnv.trim()) return true;

  const allowlist = allowlistEnv
    .split(",")
    .map((s) => s.trim().toLowerCase().replace(/\.+$/, ""))
    .filter(Boolean);

  if (allowlist.length === 0) return true;

  return allowlist.some((allowed) => {
    if (allowed.startsWith(".")) {
      const suffix = allowed.slice(1);
      return Boolean(suffix) && (hostname === suffix || hostname.endsWith(allowed));
    }
    return hostname === allowed;
  });
}

/**
 * Result of URL validation — includes the resolved IP to pin fetches against
 * DNS rebinding.  All fields are frozen strings so the validated result cannot
 * be mutated between validation and fetch (TOCTOU).
 */
export type ValidatedUrl = {
  /** The full, validated href (immutable snapshot). */
  readonly href: string;
  /** Original hostname from the URL (lowercase, bracket-stripped). */
  readonly hostname: string;
  /** The first resolved IP address, or the literal IP from the URL. */
  readonly resolvedAddress: string;
};

export async function assertPublicHttpUrl(rawUrl: unknown): Promise<ValidatedUrl> {
  if (typeof rawUrl !== "string" || rawUrl.length > 2048) {
    throw new Error("Invalid URL");
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Invalid protocol");
  }

  if (parsed.username || parsed.password) {
    throw new Error("URL credentials are not allowed");
  }

  const hostname = parsed.hostname.toLowerCase();
  const normalizedHostname = hostname.replace(/^\[|\]$/g, "").replace(/\.+$/, "");

  if (!normalizedHostname) {
    throw new Error("Invalid URL");
  }

  if (!isHostnameAllowed(normalizedHostname)) {
    throw new Error("Hostname is not allowed by configured allowlist");
  }

  if (
    normalizedHostname === "localhost" ||
    normalizedHostname.endsWith(".localhost") ||
    normalizedHostname === "metadata.google.internal" ||
    normalizedHostname === "metadata.goog" ||
    normalizedHostname.endsWith(".internal") ||
    normalizedHostname.endsWith(".local") ||
    normalizedHostname === "0.0.0.0" ||
    normalizedHostname === "::" ||
    normalizedHostname === "::1"
  ) {
    throw new Error("Fetching internal networks is prohibited");
  }

  if (!net.isIP(normalizedHostname) && parsed.hostname !== normalizedHostname) {
    parsed.hostname = normalizedHostname;
  }

  // IP-literal URL: validate directly, no DNS resolution needed.
  if (net.isIP(normalizedHostname)) {
    if (isPrivateIp(normalizedHostname)) {
      throw new Error("Fetching internal networks is prohibited");
    }
    return Object.freeze({
      href: parsed.href,
      hostname: normalizedHostname,
      resolvedAddress: normalizedHostname,
    });
  }

  // Hostname URL: resolve DNS once and pin the result.
  let addresses;
  try {
    addresses = await lookup(normalizedHostname, { all: true, verbatim: true });
  } catch {
    throw new Error("Unable to resolve URL host");
  }

  if (!addresses.length || addresses.some(({ address }) => isPrivateIp(address))) {
    throw new Error("Fetching internal networks is prohibited");
  }

  // Return an immutable snapshot — prevents mutation between validation and fetch.
  return Object.freeze({
    href: parsed.href,
    hostname: normalizedHostname,
    resolvedAddress: addresses[0].address,
  });
}

/**
 * Fetch a validated URL, pinning to the resolved IP to prevent DNS rebinding.
 * The Host header is set to the original hostname so TLS SNI and virtual
 * hosting continue to work correctly.
 */
export async function fetchPublicHttpUrl(
  validated: ValidatedUrl,
  init: RequestInit = {}
): Promise<Response> {
  let current = validated;
  const { Agent: UndiciAgent, fetch: undiciFetch } = await import("undici");

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    let dispatcher: Agent | undefined;

    // Always pin to the resolved IP via undici dispatcher when the hostname
    // differs from the resolved address (i.e. DNS-based hosts). This closes
    // the TOCTOU gap between DNS resolution and the actual TCP connection.
    if (current.hostname !== current.resolvedAddress) {
      const family = net.isIPv6(current.resolvedAddress) ? 6 : 4;
      const pinnedAddress = current.resolvedAddress;
      const pinnedHostname = current.hostname;

      dispatcher = new UndiciAgent({
        connect: {
          lookup: (hostname, _options, callback) => {
            const cleanLookupHost = hostname.toLowerCase().replace(/\.+$/, "");
            if (cleanLookupHost === pinnedHostname) {
              callback(null, [{ address: pinnedAddress, family }]);
            } else {
              // Should never happen — we construct the URL from the validated hostname.
              callback(new Error("Unexpected hostname in pinned fetch"), []);
            }
          },
        },
      });
    }

    const fetchOptions: UndiciRequestInit = {
      ...(init as UndiciRequestInit),
      redirect: "manual",
      ...(dispatcher ? { dispatcher } : {}),
    };

    let response;
    try {
      // Use the frozen href directly — no re-parsing of user-derived input.
      response = await undiciFetch(current.href, fetchOptions);
    } catch (err) {
      await dispatcher?.close().catch(() => {});
      throw err;
    }

    if (![301, 302, 303, 307, 308].includes(response.status)) {
      // Close gracefully so active response body streaming continues while the
      // dispatcher pool does not leak after this request finishes.
      void dispatcher?.close().catch(() => {});
      return response as unknown as Response;
    }

    const location = response.headers.get("location");
    if (!location) {
      void dispatcher?.close().catch(() => {});
      return response as unknown as Response;
    }

    // Drain/cancel the redirect hop body and close its dispatcher before the next hop.
    await response.body?.cancel().catch(() => {});
    await dispatcher?.close().catch(() => {});

    // Re-validate (and re-resolve DNS for) every redirect target.
    current = await assertPublicHttpUrl(new URL(location, current.href).toString());
  }

  throw new Error("Too many redirects");
}

export async function readResponseTextWithLimit(
  response: Response,
  maxBytes: number
): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isSafeInteger(declaredLength) && declaredLength > maxBytes) {
    throw new Error("Remote response is too large");
  }

  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      receivedBytes += value.byteLength;
      if (receivedBytes > maxBytes) {
        await reader.cancel("Remote response exceeded the configured size limit");
        throw new Error("Remote response is too large");
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const buffer = new Uint8Array(receivedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(buffer);
}

export async function readResponseBytesWithLimit(
  response: Response,
  maxBytes: number
): Promise<Uint8Array> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isSafeInteger(declaredLength) && declaredLength > maxBytes) {
    throw new Error("Remote response is too large");
  }
  if (!response.body) return new Uint8Array();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      receivedBytes += value.byteLength;
      if (receivedBytes > maxBytes) {
        await reader.cancel("Remote response exceeded the configured size limit");
        throw new Error("Remote response is too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(receivedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
