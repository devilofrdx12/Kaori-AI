/**
 * ISTQB Test Suite: Spend Guard — Cost Estimation
 *
 * Techniques applied:
 *   - Equivalence Partitioning (model families)
 *   - Boundary Value Analysis (edge costs)
 *   - Error Guessing (unknown models, zero output)
 *
 * Test Basis: spend-guard.ts — estimateChatCostUsd (pure function, no DB needed)
 */

import assert from "node:assert/strict";
import test from "node:test";
import { estimateChatCostUsd } from "./spend-guard";

// ════════════════════════════════════════════════
// MODEL COST LOOKUP — EP
// ════════════════════════════════════════════════

test("Gemini 3.5 Flash uses its specific rate ($0.0004/1K)", () => {
  // 4000 chars ≈ 1000 tokens at 4 chars/token
  const cost = estimateChatCostUsd("gemini-3.5-flash", 4000);
  // Expected: 1000/1000 * 0.0004 = $0.0004
  assert.ok(Math.abs(cost - 0.0004) < 0.0001, `Cost ${cost} should be ~$0.0004`);
});

test("Nvidia models use the nvidia/ prefix rate ($0.001/1K)", () => {
  const cost = estimateChatCostUsd("nvidia/nemotron-3-ultra-550b-a55b", 4000);
  // 1000 tokens * $0.001/1K = $0.001
  assert.ok(Math.abs(cost - 0.001) < 0.0001, `Cost ${cost} should be ~$0.001`);
});

test("DeepSeek model uses the deepseek-ai/ rate ($0.0014/1K)", () => {
  const cost = estimateChatCostUsd("deepseek-ai/deepseek-v4-flash-0731", 4000);
  assert.ok(Math.abs(cost - 0.0014) < 0.0002, `Cost ${cost} should be ~$0.0014`);
});

test("OpenAI-compatible model uses openai/ rate ($0.0005/1K)", () => {
  const cost = estimateChatCostUsd("openai/gpt-oss-120b", 4000);
  assert.ok(Math.abs(cost - 0.0005) < 0.0002, `Cost ${cost} should be ~$0.0005`);
});

test("Z-AI GLM model uses z-ai/ rate ($0.001/1K)", () => {
  const cost = estimateChatCostUsd("z-ai/glm-5.2", 4000);
  assert.ok(Math.abs(cost - 0.001) < 0.0001, `Cost ${cost} should be ~$0.001`);
});

// ════════════════════════════════════════════════
// LONGEST PREFIX MATCH — specific model beats fallback
// ════════════════════════════════════════════════

test("gemini-3.5-flash gets more specific rate than gemini- fallback", () => {
  const specificCost = estimateChatCostUsd("gemini-3.5-flash", 4000);
  const fallbackCost = estimateChatCostUsd("gemini-2.0-imaginary", 4000);
  assert.ok(specificCost < fallbackCost, "Specific gemini-3.5-flash rate should be cheaper than generic gemini- fallback");
});

// ════════════════════════════════════════════════
// EDGE CASES — BVA + Error Guessing
// ════════════════════════════════════════════════

test("zero output characters returns minimum cost (1 token)", () => {
  const cost = estimateChatCostUsd("gemini-3.5-flash", 0);
  // Math.max(1, 0/4) = 1 token → 1/1000 * 0.0004 = $0.0000004
  assert.ok(cost > 0, "Cost should be positive even for zero output");
  assert.ok(cost < 0.001, "Cost should be very small for zero output");
});

test("very large output calculates correctly", () => {
  const cost = estimateChatCostUsd("gemini-3.5-flash", 1_000_000);
  // 250000 tokens → 250 × $0.0004 = $0.10
  assert.ok(Math.abs(cost - 0.10) < 0.01, `Cost ${cost} should be ~$0.10`);
});

test("unknown model uses conservative fallback rate ($0.001/1K)", () => {
  const cost = estimateChatCostUsd("totally-unknown-model", 4000);
  // 1000 tokens × $0.001/1K = $0.001
  assert.ok(Math.abs(cost - 0.001) < 0.0001, `Cost ${cost} should be ~$0.001 (fallback)`);
});
