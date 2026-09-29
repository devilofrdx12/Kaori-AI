/**
 * ISTQB Test Suite: QuartzWall Capability Firewall (Extended)
 *
 * Techniques applied:
 *   - Decision Table (tool × input × intent → verdict)
 *   - Equivalence Partitioning (valid/invalid tool names, schemes, formats)
 *   - Error Guessing (bypass attempts)
 *
 * Test Basis: quartzwall/capability-firewall.ts — validateToolCall
 */

import assert from "node:assert/strict";
import test from "node:test";
import { validateToolCall } from "./capability-firewall";

// ════════════════════════════════════════════════
// UNKNOWN TOOLS — always BLOCKED
// ════════════════════════════════════════════════

test("unknown tool name is blocked with risk 95", () => {
  const result = validateToolCall("execute_shell", { command: "rm -rf /" }, "run a command");
  assert.equal(result.allowed, false);
  assert.equal(result.verdict, "BLOCKED");
  assert.ok(result.risk >= 90);
});

test("empty tool name is blocked", () => {
  const result = validateToolCall("", {}, "");
  assert.equal(result.allowed, false);
});

// ════════════════════════════════════════════════
// WEB SEARCH — abusive query detection
// ════════════════════════════════════════════════

test("normal web search is allowed", () => {
  const result = validateToolCall("web_search", { query: "weather in Tokyo" }, "What's the weather?");
  assert.equal(result.allowed, true);
  assert.equal(result.verdict, "SAFE");
});

test("empty search query is blocked", () => {
  const result = validateToolCall("web_search", { query: "" }, "Search for nothing");
  assert.equal(result.allowed, false);
});

test("credential-harvesting search query is blocked", () => {
  const result = validateToolCall("web_search", { query: "password dump site:pastebin.com" }, "Find passwords");
  assert.equal(result.allowed, false);
  assert.ok(result.signals.some(s => s.label === "abusive-search"));
});

test("leaked credentials search is blocked", () => {
  const result = validateToolCall("web_search", { query: "leaked credentials database" }, "Find data");
  assert.equal(result.allowed, false);
});

// ════════════════════════════════════════════════
// WEB FETCH — URL validation
// ════════════════════════════════════════════════

test("web_fetch with http URL is allowed", () => {
  const result = validateToolCall("web_fetch", { url: "https://example.com/page" }, "Fetch this page");
  assert.equal(result.allowed, true);
});

test("web_fetch with blocked domain is rejected", () => {
  const result = validateToolCall("web_fetch", { url: "https://pastebin.com/raw/abc123" }, "Read paste");
  assert.equal(result.allowed, false);
  assert.ok(result.signals.some(s => s.label === "blocked-domain"));
});

test("web_fetch with credentials in URL is rejected", () => {
  const result = validateToolCall("web_fetch", { url: "https://user:pass@example.com" }, "Fetch page");
  assert.equal(result.allowed, false);
  assert.ok(result.signals.some(s => s.label === "url-credentials"));
});

test("web_fetch with non-http protocol is rejected", () => {
  const result = validateToolCall("web_fetch", { url: "ftp://files.example.com/data" }, "Download file");
  assert.equal(result.allowed, false);
  assert.ok(result.signals.some(s => s.label === "blocked-protocol"));
});

test("web_fetch with missing URL is rejected", () => {
  const result = validateToolCall("web_fetch", { url: "" }, "Fetch something");
  assert.equal(result.allowed, false);
});

// ════════════════════════════════════════════════
// OPEN APPLICATION — intent verification
// ════════════════════════════════════════════════

test("open_application without user intent is blocked", () => {
  const result = validateToolCall(
    "open_application",
    { uriScheme: "spotify:", fallbackUrl: "https://open.spotify.com" },
    "What time is it?"  // No intent to open an app
  );
  assert.equal(result.allowed, false);
  assert.ok(result.signals.some(s => s.label === "missing-user-intent"));
});

test("open_application with blocked scheme (file:) is rejected", () => {
  const result = validateToolCall(
    "open_application",
    { uriScheme: "file:///etc/passwd", fallbackUrl: "https://example.com" },
    "Open file manager"
  );
  assert.equal(result.allowed, false);
});

test("open_application with blocked scheme (javascript:) is rejected", () => {
  const result = validateToolCall(
    "open_application",
    { uriScheme: "javascript:alert(1)", fallbackUrl: "https://example.com" },
    "Open an application"
  );
  assert.equal(result.allowed, false);
});

// ════════════════════════════════════════════════
// PLAY SPOTIFY — intent verification
// ════════════════════════════════════════════════

test("play_spotify without user intent is blocked", () => {
  const result = validateToolCall("play_spotify", { query: "despacito" }, "What is quantum physics?");
  assert.equal(result.allowed, false);
  assert.ok(result.signals.some(s => s.label === "missing-user-intent"));
});

test("play_spotify with user intent is allowed", () => {
  const result = validateToolCall("play_spotify", { query: "despacito" }, "Play despacito on Spotify");
  assert.equal(result.allowed, true);
});

// ════════════════════════════════════════════════
// OPEN YOUTUBE — intent verification
// ════════════════════════════════════════════════

test("open_youtube without user intent is blocked", () => {
  const result = validateToolCall("open_youtube", { query: "cat videos" }, "Tell me about cats");
  assert.equal(result.allowed, false);
});

test("open_youtube with user intent is allowed", () => {
  const result = validateToolCall("open_youtube", { query: "coding tutorial" }, "Open YouTube and search coding tutorial");
  assert.equal(result.allowed, true);
});

// ════════════════════════════════════════════════
// CREATE DOCUMENT — format, filename, content validation
// ════════════════════════════════════════════════

test("document with disallowed format is blocked", () => {
  const result = validateToolCall(
    "create_document",
    { filename: "script.sh", format: "sh", content: "#!/bin/bash\nrm -rf /" },
    "Create a shell script"
  );
  assert.equal(result.allowed, false);
  assert.ok(result.signals.some(s => s.label === "blocked-document-format"));
});

test("document with all valid formats are accepted", () => {
  const formats = ["pdf", "docx", "md", "html", "css", "js", "ts", "tsx", "jsx", "json"];
  for (const format of formats) {
    const result = validateToolCall(
      "create_document",
      { filename: `file.${format}`, format, content: "# Content" },
      `Create a ${format} document`
    );
    assert.equal(result.allowed, true, `Format '${format}' should be allowed`);
  }
});

test("document with empty content is blocked", () => {
  const result = validateToolCall(
    "create_document",
    { filename: "doc.md", format: "md", content: "" },
    "Create a document"
  );
  assert.equal(result.allowed, false);
});

test("document with excessively large content is blocked", () => {
  const result = validateToolCall(
    "create_document",
    { filename: "doc.md", format: "md", content: "x".repeat(250_000) },
    "Create a document"
  );
  assert.equal(result.allowed, false);
});

test("document with private key content is blocked", () => {
  const result = validateToolCall(
    "create_document",
    {
      filename: "keys.md",
      format: "md",
      content: "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----"
    },
    "Create a document with keys"
  );
  assert.equal(result.allowed, false);
  assert.ok(result.signals.some(s => s.label === "sensitive-document-content"));
});

test("document with path traversal filename is blocked", () => {
  const result = validateToolCall(
    "create_document",
    { filename: "../../etc/passwd", format: "md", content: "# Hello" },
    "Create a document"
  );
  assert.equal(result.allowed, false);
});

test("analyze_pdf_visuals is a known allowed tool", () => {
  const result = validateToolCall("analyze_pdf_visuals", { file: "test.pdf" }, "Analyze this PDF");
  assert.equal(result.allowed, true);
});
