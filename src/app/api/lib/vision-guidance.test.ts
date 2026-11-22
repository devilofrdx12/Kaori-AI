import assert from "node:assert/strict";
import test from "node:test";
import { buildVisionGuidance } from "../chat/route";

test("Tier 1: price and buying questions trigger grounded anchor search protocol", () => {
  const result = buildVisionGuidance("How much does this watch cost and where to buy?");
  assert.ok(result.includes("Grounded External Verification"), "Should trigger grounded verification");
  assert.ok(result.includes("EXACT grounded textual anchors"), "Should demand exact anchors");
  assert.ok(result.includes("Do NOT search vague subjective visual descriptions"), "Should forbid vague aesthetic searches");
});

test("Tier 2: document, code, and receipt questions trigger OCR protocol", () => {
  const result = buildVisionGuidance("Can you read this receipt and transcribe the items?");
  assert.ok(result.includes("Document / Code / OCR"), "Should trigger OCR protocol");
  assert.ok(result.includes("Transcribe visible text, code, numbers"), "Should focus on transcription");
  assert.ok(result.includes("without web search"), "Should avoid unnecessary web search");
});

test("Tier 2: error screens and stack traces allow targeted error string search", () => {
  const result = buildVisionGuidance("Why am I getting this terminal error stack trace?");
  assert.ok(result.includes("Document / Code / OCR"), "Should identify error/code task");
  assert.ok(result.includes("exact transcribed error string"), "Should specify searching only exact error string");
});

test("Tier 3: math and equation questions trigger direct analytical solving without search", () => {
  const result = buildVisionGuidance("Solve this calculus math equation from my homework");
  assert.ok(result.includes("Technical / Analytical"), "Should trigger analytical math protocol");
  assert.ok(result.includes("directly from your visual tokens"), "Should solve directly from vision");
  assert.ok(result.includes("Do not perform web searches"), "Should avoid searching math questions");
});

test("Tier 4: image comparison triggers structured visual comparison", () => {
  const result = buildVisionGuidance("What is the difference between these two images?");
  assert.ok(result.includes("Visual Comparison"), "Should trigger comparison protocol");
  assert.ok(result.includes("Compare and contrast specific visual elements"), "Should compare visual elements");
});

test("Tier 5: general photos use native multimodal observation first", () => {
  const result = buildVisionGuidance("What kind of plant is this?");
  assert.ok(result.includes("Direct Observation & Entity Recognition"), "Should trigger direct observation protocol");
  assert.ok(result.includes("using your native multimodal vision capabilities"), "Should trust native vision");
  assert.ok(!result.includes("MANDATORY VISUAL SEARCH"), "Must NEVER force mandatory search on general photos");
});
