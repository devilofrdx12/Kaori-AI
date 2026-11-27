import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  assertPublicHttpUrl,
  isPrivateIp,
  isPrivateIpv4,
  isPrivateIpv6,
} from "./url-safety";
import {
  createOAuthState,
  issueAccessToken,
  verifyAccessToken,
  verifyOAuthState,
} from "./auth-utils";
import {
  CHAT_REQUEST_RESERVE_USD,
  DAILY_LIMIT,
  DAILY_PRO_LIMIT,
  refundChatSpend,
  reserveChatSpend,
} from "./spend-guard";

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..", "..");

function ensureTestSecrets() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    process.env.JWT_SECRET = "test-jwt-secret-key-for-regression-suite-12345";
  }
  if (!process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET.length < 32) {
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret-key-for-regression-suite-67890";
  }
}

test("SEC-A04: isPrivateIpv6 blocks IPv4-mapped metadata, hex mapped, link-local, 6to4, NAT64, and malformed IPv6", () => {
  const blockedV6 = [
    "::",
    "0:0:0:0:0:0:0:0",
    "::1",
    "0:0:0:0:0:0:0:1",
    "::ffff:169.254.169.254",
    "::ffff:7f00:1",
    "0:0:0:0:0:ffff:a9fe:a9fe",
    "::ffff:10.0.0.1",
    "::ffff:192.168.1.1",
    "::ffff:100.64.0.1",
    "::127.0.0.1",
    "::169.254.169.254",
    "fc00::1",
    "fd12:3456:789a::1",
    "fe80::1",
    "fe90::1",
    "febf:ffff::1",
    "fec0::1",
    "ff00::",
    "ff02::1",
    "2001:0000::1",
    "2001:0002::1",
    "2001:0db8::1",
    "2002:7f00:0001::1",
    "2002:a9fe:a9fe::1",
    "0064:ff9b::1",
    "64:ff9b::127.0.0.1",
    "0064:ff9b:0001::1",
    "fe80::1%eth0",
    "not-an-ip",
    "1:2:3:4:5:6:7:8:9",
  ];

  for (const ip of blockedV6) {
    assert.equal(isPrivateIpv6(ip), true, `Expected IPv6 ${ip} to be blocked`);
  }

  const publicV6 = [
    "2606:4700:4700::1111",
    "2001:4860:4860::8888",
    "::ffff:8.8.8.8",
    "2002:0808:0808::1",
  ];
  for (const ip of publicV6) {
    assert.equal(isPrivateIpv6(ip), false, `Expected IPv6 ${ip} to be allowed`);
    assert.equal(isPrivateIp(ip), false, `Expected IP ${ip} to be allowed`);
  }

  assert.equal(isPrivateIpv4("169.254.169.254"), true);
  assert.equal(isPrivateIpv4("8.8.8.8"), false);
});

test("SEC-A04/A05: assertPublicHttpUrl blocks metadata/trailing-dot/IPv6 bypasses and respects optional ALLOWED_FETCH_HOSTS", async () => {
  const prevAllowlist = process.env.ALLOWED_FETCH_HOSTS;
  try {
    delete process.env.ALLOWED_FETCH_HOSTS;
    const okUnset = await assertPublicHttpUrl("https://8.8.8.8/resource");
    assert.equal(okUnset.resolvedAddress, "8.8.8.8");

    process.env.ALLOWED_FETCH_HOSTS = "   ";
    const okBlank = await assertPublicHttpUrl("https://1.1.1.1/resource");
    assert.equal(okBlank.resolvedAddress, "1.1.1.1");

    const blockedUrls = [
      "http://localhost./",
      "http://sub.localhost../",
      "http://metadata.google.internal./",
      "http://metadata.goog/",
      "http://internal-service.internal/",
      "http://printer.local/",
      "http://[::ffff:169.254.169.254]/latest/meta-data",
      "http://[::ffff:7f00:1]/",
      "http://[0:0:0:0:0:ffff:a9fe:a9fe]/",
      "http://[2002:a9fe:a9fe::1]/",
    ];
    for (const url of blockedUrls) {
      await assert.rejects(() => assertPublicHttpUrl(url), /prohibited/i, `Expected ${url} to be rejected`);
    }

    process.env.ALLOWED_FETCH_HOSTS = "example.com";
    await assert.rejects(() => assertPublicHttpUrl("https://8.8.8.8/resource"), /allowlist/i);
  } finally {
    if (prevAllowlist === undefined) delete process.env.ALLOWED_FETCH_HOSTS;
    else process.env.ALLOWED_FETCH_HOSTS = prevAllowlist;
  }
});

test("SEC-A06: access JWT embeds session id (sid) and token version (tv) and OAuth state is HMAC verified", () => {
  ensureTestSecrets();

  const token = issueAccessToken("user-1", "user@example.com", "sess-123", 4);
  const payload = verifyAccessToken(token);
  assert.ok(payload, "Token should verify");
  assert.equal(payload.userId, "user-1");
  assert.equal(payload.email, "user@example.com");
  assert.equal(payload.sid, "sess-123");
  assert.equal(payload.tv, 4);

  const oauth = createOAuthState("google", "user-1");
  assert.equal(verifyOAuthState("google", oauth.state, oauth.cookieValue), "user-1");
  assert.equal(verifyOAuthState("spotify", oauth.state, oauth.cookieValue), null);
  assert.equal(verifyOAuthState("google", "tampered", oauth.cookieValue), null);
  assert.equal(verifyOAuthState("google", oauth.state, oauth.cookieValue + "x"), null);
});

test("SEC-A01 & SEC-A07: CodeBlock preview sandbox omits allow-same-origin and MessageRow sanitizeSchema omits style", () => {
  const codeBlockSrc = fs.readFileSync(path.join(REPO_ROOT, "src/components/code-block.tsx"), "utf8");
  assert.ok(codeBlockSrc.includes('sandbox="allow-scripts"'), "Preview iframe must use sandbox='allow-scripts' only");
  assert.ok(!codeBlockSrc.includes("allow-same-origin"), "Preview iframe must never combine allow-scripts with allow-same-origin");

  const messageRowSrc = fs.readFileSync(path.join(REPO_ROOT, "src/components/message-row.tsx"), "utf8");
  const schemaMatch = messageRowSrc.match(/const sanitizeSchema\s*=\s*\{[\s\S]*?\};/);
  assert.ok(schemaMatch, "sanitizeSchema should be defined");
  assert.ok(!schemaMatch[0].includes('"style"'), "sanitizeSchema must not allow raw inline style attributes");
  assert.ok(messageRowSrc.includes("maxSize: 20"), "KaTeX rendering should bound maxSize");
});

test("SEC-A08 & SEC-A10: API routes enforce bounded JSON parsing and AJAX header checks", () => {
  const boundedRoutes = [
    "src/app/api/memories/route.ts",
    "src/app/api/memories/[id]/route.ts",
    "src/app/api/memories/import/route.ts",
    "src/app/api/memory-settings/route.ts",
    "src/app/api/projects/route.ts",
    "src/app/api/projects/[id]/route.ts",
    "src/app/api/tools/web-search/route.ts",
    "src/app/api/tools/web-fetch/route.ts",
    "src/app/api/user/sessions/route.ts",
  ];

  for (const relPath of boundedRoutes) {
    const content = fs.readFileSync(path.join(REPO_ROOT, relPath), "utf8");
    assert.ok(content.includes("readJsonBodyWithLimit"), `${relPath} must use readJsonBodyWithLimit`);
    assert.ok(!content.includes("req.json("), `${relPath} must not call unbounded req.json()`);
  }

  const exportRoute = fs.readFileSync(path.join(REPO_ROOT, "src/app/api/memories/export/route.ts"), "utf8");
  assert.ok(exportRoute.includes("requireAjax(req)"), "memories/export GET must enforce requireAjax");
});

test("BUG-04: spend guard exports symmetric reserve/refund functions and positive limits", () => {
  assert.equal(typeof reserveChatSpend, "function");
  assert.equal(typeof refundChatSpend, "function");
  assert.equal(reserveChatSpend.length >= 1, true);
  assert.equal(refundChatSpend.length >= 1, true);
  assert.ok(DAILY_PRO_LIMIT > DAILY_LIMIT);
  assert.ok(CHAT_REQUEST_RESERVE_USD > 0);
});
