import { lookup } from "node:dns/promises";
import net from "node:net";
import { Agent } from "undici";

const MAX_REDIRECTS = 3;

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return true;
  const [a, b] = parts;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||  // RFC 6598 CGNAT
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("::ffff:127.") ||
    normalized.startsWith("::ffff:10.") ||
    normalized.startsWith("::ffff:192.168.") ||
    /^::ffff:172\.(1[6-9]|2\d|3[0-1])\./.test(normalized) ||
    /^::ffff:100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\./.test(normalized)  // CGNAT mapped
  );
}

function isPrivateIp(ip: string): boolean {
  const version = net.isIP(ip);
  if (version === 4) return isPrivateIpv4(ip);
  if (version === 6) return isPrivateIpv6(ip);
  return true;
}

function isHostnameAllowed(hostname: string): boolean {
  const allowlistEnv = process.env.ALLOWED_FETCH_HOSTS;
  if (!allowlistEnv) return false;

  const allowlist = allowlistEnv
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
    
  if (allowlist.length === 0) return false;

  return allowlist.some((allowed) => {
    if (allowed.startsWith(".")) {
      return hostname === allowed.slice(1) || hostname.endsWith(allowed);
    }
    return hostname === allowed;
  });
}

/** Result of URL validation — includes the resolved IP to pin fetches against DNS rebinding. */
export type ValidatedUrl = {
  url: URL;
  /** The first resolved IP address, or the literal IP from the URL. `null` for IP-literal URLs that were validated directly. */
  resolvedAddress: string | null;
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
  const normalizedHostname = hostname.replace(/^\[|\]$/g, "");

  if (!isHostnameAllowed(normalizedHostname)) {
    throw new Error("Hostname is not allowed by configured allowlist");
  }

  if (
    normalizedHostname === "localhost" ||
    normalizedHostname.endsWith(".localhost") ||
    normalizedHostname === "0.0.0.0" ||
    normalizedHostname === "::" ||
    normalizedHostname === "::1"
  ) {
    throw new Error("Fetching internal networks is prohibited");
  }

  // IP-literal URL: validate directly, no DNS resolution needed.
  if (net.isIP(normalizedHostname)) {
    if (isPrivateIp(normalizedHostname)) {
      throw new Error("Fetching internal networks is prohibited");
    }
    return { url: parsed, resolvedAddress: normalizedHostname };
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

  // Return the first resolved address for fetch pinning.
  return { url: parsed, resolvedAddress: addresses[0].address };
}

/**
 * Fetch a validated URL, pinning to the resolved IP to prevent DNS rebinding.
 * The Host header is set to the original hostname so TLS SNI and virtual
 * hosting continue to work correctly.
 */
export async function fetchPublicHttpUrl(
  validated: ValidatedUrl,
  init: RequestInit = {}
) {
  let current = validated;

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    let dispatcher: Agent | undefined;

    if (current.resolvedAddress && current.url.hostname !== current.resolvedAddress) {
      const family = net.isIPv6(current.resolvedAddress) ? 6 : 4;
      const pinnedAddress = current.resolvedAddress;
      
      dispatcher = new Agent({
        connect: {
          lookup: (hostname, options, callback) => {
            if (hostname === current.url.hostname) {
              callback(null, [{ address: pinnedAddress, family }]);
            } else {
              import("node:dns").then(dns => dns.lookup(hostname, options, callback));
            }
          }
        }
      });
    }

    // Cast options to any to allow the undici-specific `dispatcher` property
    const fetchOptions: any = {
      ...init,
      redirect: "manual",
    };
    if (dispatcher) {
      fetchOptions.dispatcher = dispatcher;
    }

    const response = await fetch(new URL(current.url.toString()), fetchOptions);

    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return response;
    }

    const location = response.headers.get("location");
    if (!location) return response;

    // Re-validate (and re-resolve DNS for) every redirect target.
    current = await assertPublicHttpUrl(new URL(location, current.url).toString());
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
