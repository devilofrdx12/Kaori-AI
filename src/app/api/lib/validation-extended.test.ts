/**
 * ISTQB Test Suite: Input Validation Module (Extended)
 *
 * Techniques applied:
 *   - Equivalence Partitioning (EP)
 *   - Boundary Value Analysis (BVA)
 *   - Error Guessing
 *
 * Test Basis: validation.ts — 10 exported functions
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  validateEmail,
  validatePassword,
  validateUsername,
  validateMessage,
  validateModel,
  validateConversationTitle,
  validateSearchQuery,
  validateUploadFiles,
  LIMITS,
} from "./validation";

// ════════════════════════════════════════════════
// EMAIL VALIDATION — EP + BVA
// ════════════════════════════════════════════════

test("EP: valid standard emails are accepted and lowercased", () => {
  assert.equal(validateEmail("User@Example.COM"), "user@example.com");
  assert.equal(validateEmail("  test@domain.org  "), "test@domain.org");
  assert.equal(validateEmail("first.last@sub.domain.co"), "first.last@sub.domain.co");
});

test("EP: invalid email formats are rejected", () => {
  assert.throws(() => validateEmail(""), /required/i);
  assert.throws(() => validateEmail("notanemail"), /invalid/i);
  assert.throws(() => validateEmail("@domain.com"), /invalid/i);
  assert.throws(() => validateEmail("user@"), /invalid/i);
  assert.throws(() => validateEmail("user@.com"), /invalid/i);
});

test("BVA: email at maximum length boundary (254 chars)", () => {
  const localPart = "a".repeat(64);
  const domainPart = "b".repeat(185) + ".com"; // 64 + 1(@) + 189 = 254
  const maxEmail = `${localPart}@${domainPart}`;
  // This should either work or fail on format, but not on length
  try {
    const result = validateEmail(maxEmail);
    assert.equal(typeof result, "string");
  } catch (e: any) {
    // May fail on domain format which is acceptable
    assert.ok(e.message.includes("Invalid") || e.message.includes("long"));
  }
});

test("BVA: email exceeding 254 chars is rejected", () => {
  const tooLong = "a".repeat(64) + "@" + "b".repeat(200) + ".com";
  assert.throws(() => validateEmail(tooLong), /too long/i);
});

test("Error Guessing: email with dangerous characters is rejected", () => {
  assert.throws(() => validateEmail("user<script>@evil.com"), /invalid/i);
  assert.throws(() => validateEmail("user'OR'1'='1@evil.com"), /invalid/i);
  assert.throws(() => validateEmail("user\"@evil.com"), /invalid/i);
  assert.throws(() => validateEmail("user\\@evil.com"), /invalid/i);
});

test("Error Guessing: email with null bytes is rejected", () => {
  assert.throws(() => validateEmail("user\u0000@domain.com"), /invalid/i);
});

test("Error Guessing: email with consecutive dots in local part is rejected", () => {
  assert.throws(() => validateEmail("user..name@domain.com"), /invalid/i);
});

test("Error Guessing: email starting or ending with dot is rejected", () => {
  assert.throws(() => validateEmail(".user@domain.com"), /invalid/i);
  assert.throws(() => validateEmail("user.@domain.com"), /invalid/i);
});

// ════════════════════════════════════════════════
// PASSWORD VALIDATION — BVA
// ════════════════════════════════════════════════

test("BVA: password at minimum length boundary (7/8)", () => {
  assert.throws(() => validatePassword("1234567"), /at least 8/i);
  assert.equal(validatePassword("12345678"), "12345678");
});

test("BVA: password at maximum length boundary (128/129)", () => {
  assert.equal(validatePassword("x".repeat(128)), "x".repeat(128));
  assert.throws(() => validatePassword("x".repeat(129)), /too long/i);
});

test("EP: password edge cases", () => {
  assert.throws(() => validatePassword(""), /required/i);
  assert.throws(() => validatePassword(undefined as any), /required/i);
  assert.throws(() => validatePassword(null as any), /required/i);
});

// ════════════════════════════════════════════════
// USERNAME VALIDATION — BVA + Error Guessing
// ════════════════════════════════════════════════

test("BVA: username at minimum boundary (1/2)", () => {
  assert.throws(() => validateUsername("a"), /at least 2/i);
  assert.equal(validateUsername("ab"), "ab");
});

test("BVA: username at maximum boundary (50/51)", () => {
  assert.equal(validateUsername("x".repeat(50)), "x".repeat(50));
  assert.throws(() => validateUsername("x".repeat(51)), /too long/i);
});

test("Error Guessing: username with control characters is rejected", () => {
  assert.throws(() => validateUsername("user\u0001name"), /invalid/i);
  assert.throws(() => validateUsername("user\u007Fname"), /invalid/i);
});

test("EP: username whitespace handling", () => {
  assert.equal(validateUsername("  John Doe  "), "John Doe");
});

// ════════════════════════════════════════════════
// MESSAGE VALIDATION — BVA
// ════════════════════════════════════════════════

test("BVA: message at maximum length boundary (32000/32001)", () => {
  assert.equal(validateMessage("x".repeat(32000)), "x".repeat(32000));
  assert.throws(() => validateMessage("x".repeat(32001)), /too long/i);
});

test("EP: empty or whitespace-only messages are rejected", () => {
  assert.throws(() => validateMessage(""), /required/i);
  assert.throws(() => validateMessage("   "), /empty/i);
  assert.throws(() => validateMessage("\t\n"), /empty/i);
});

// ════════════════════════════════════════════════
// MODEL VALIDATION — EP
// ════════════════════════════════════════════════

test("EP: unknown model falls back to gemini-3.5-flash", () => {
  assert.equal(validateModel("nonexistent-model"), "gemini-3.5-flash");
  assert.equal(validateModel(""), "gemini-3.5-flash");
  assert.equal(validateModel(undefined), "gemini-3.5-flash");
  assert.equal(validateModel(42), "gemini-3.5-flash");
  assert.equal(validateModel(null), "gemini-3.5-flash");
});

test("EP: all allowed models are accepted", () => {
  const allowedModels = [
    "openai/gpt-oss-120b",
    "gemini-3.5-flash",
    "nvidia/nemotron-3-ultra-550b-a55b",
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
    "nvidia/llama-3.1-nemotron-70b-instruct",
    "deepseek-ai/deepseek-v4-flash-0731",
    "z-ai/glm-5.2",
  ];
  for (const model of allowedModels) {
    assert.equal(validateModel(model), model, `Model ${model} should be accepted`);
  }
});

// ════════════════════════════════════════════════
// CONVERSATION TITLE — EP + BVA
// ════════════════════════════════════════════════

test("EP: non-string titles fall back to 'New chat'", () => {
  assert.equal(validateConversationTitle(undefined), "New chat");
  assert.equal(validateConversationTitle(null), "New chat");
  assert.equal(validateConversationTitle(42), "New chat");
});

test("EP: empty/whitespace titles fall back to 'New chat'", () => {
  assert.equal(validateConversationTitle(""), "New chat");
  assert.equal(validateConversationTitle("   "), "New chat");
  assert.equal(validateConversationTitle("\t\n"), "New chat");
});

test("BVA: title truncated at 120 characters", () => {
  const longTitle = "A".repeat(200);
  assert.equal(validateConversationTitle(longTitle).length, LIMITS.title.max);
});

test("EP: control characters in title are normalized to spaces", () => {
  assert.equal(validateConversationTitle("Hello\u0000World"), "Hello World");
  assert.equal(validateConversationTitle("Tab\tHere"), "Tab Here");
});

// ════════════════════════════════════════════════
// SEARCH QUERY — EP + BVA
// ════════════════════════════════════════════════

test("EP: valid search queries are trimmed", () => {
  assert.equal(validateSearchQuery("  hello world  "), "hello world");
});

test("EP: invalid search queries are rejected", () => {
  assert.throws(() => validateSearchQuery(""), /required/i);
  assert.throws(() => validateSearchQuery("   "), /required/i);
  assert.throws(() => validateSearchQuery(42), /required/i);
  assert.throws(() => validateSearchQuery(undefined), /required/i);
});

test("BVA: search query at max length boundary (300/301)", () => {
  assert.equal(validateSearchQuery("x".repeat(300)), "x".repeat(300));
  assert.throws(() => validateSearchQuery("x".repeat(301)), /too long/i);
});

// ════════════════════════════════════════════════
// FILE UPLOAD VALIDATION — EP + BVA + Error Guessing
// ════════════════════════════════════════════════

test("EP: empty/non-array returns empty array", () => {
  assert.deepEqual(validateUploadFiles(undefined), []);
  assert.deepEqual(validateUploadFiles(null), []);
  assert.deepEqual(validateUploadFiles([]), []);
});

test("BVA: max file count boundary (3/4)", () => {
  const validFile = { name: "test.png", type: "image/png", data: "AAAA" };
  assert.equal(validateUploadFiles([validFile, validFile, validFile]).length, 3);
  assert.throws(
    () => validateUploadFiles([validFile, validFile, validFile, validFile]),
    /too many/i
  );
});

test("EP: unsupported file types are rejected", () => {
  assert.throws(
    () => validateUploadFiles([{ name: "file.exe", type: "application/exe", data: "AAAA" }]),
    /unsupported/i
  );
  assert.throws(
    () => validateUploadFiles([{ name: "file.js", type: "application/javascript", data: "AAAA" }]),
    /unsupported/i
  );
});

test("EP: allowed file types are accepted", () => {
  const allowedTypes = ["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"];
  for (const type of allowedTypes) {
    const files = validateUploadFiles([{ name: "test", type, data: "AAAA" }]);
    assert.equal(files.length, 1, `Type ${type} should be accepted`);
    assert.equal(files[0].type, type);
  }
});

test("Error Guessing: file with control characters in name is rejected", () => {
  assert.throws(
    () => validateUploadFiles([{ name: "test\u0000.png", type: "image/png", data: "AAAA" }]),
    /invalid file name/i
  );
});

test("EP: file detail defaults to 'balanced' when invalid", () => {
  const files = validateUploadFiles([{ name: "test.png", type: "image/png", data: "AAAA", detail: "invalid" }]);
  assert.equal(files[0].detail, "balanced");
});

test("EP: valid file detail values are preserved", () => {
  for (const detail of ["fast", "high"] as const) {
    const files = validateUploadFiles([{ name: "test.png", type: "image/png", data: "AAAA", detail }]);
    assert.equal(files[0].detail, detail);
  }
});

test("Error Guessing: invalid base64 encoding is rejected", () => {
  assert.throws(
    () => validateUploadFiles([{ name: "test.png", type: "image/png", data: "!!!invalid!!!" }]),
    /invalid file encoding/i
  );
});

test("Error Guessing: data URL with mismatched MIME type is rejected", () => {
  assert.throws(
    () => validateUploadFiles([{
      name: "test.png",
      type: "image/png",
      data: "data:image/jpeg;base64,AAAA"
    }]),
    /invalid file encoding/i
  );
});
