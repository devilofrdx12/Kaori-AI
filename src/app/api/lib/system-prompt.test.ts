/**
 * ISTQB Test Suite: System Prompt Builder
 *
 * Techniques applied:
 *   - Branch Coverage (study mode on/off)
 *   - Statement Coverage (time context inclusion)
 *
 * Test Basis: system-prompt.ts — buildSystemPrompt
 */

import assert from "node:assert/strict";
import test from "node:test";
import { buildSystemPrompt, KAORI_PERSONALITY_CORE } from "./system-prompt";

test("default prompt includes personality core and time context", () => {
  const prompt = buildSystemPrompt();
  assert.ok(prompt.includes("You are Kaori"), "Should include Kaori personality");
  assert.ok(prompt.includes("CURRENT TIME CONTEXT"), "Should include time context");
  assert.ok(prompt.includes("UTC"), "Should include UTC reference");
  assert.ok(!prompt.includes("STUDY MODE IS ACTIVE"), "Should NOT include study mode by default");
});

test("study mode prompt appends Socratic tutor directive", () => {
  const prompt = buildSystemPrompt(true);
  assert.ok(prompt.includes("STUDY MODE IS ACTIVE"), "Should include study mode");
  assert.ok(prompt.includes("Socratic"), "Should mention Socratic method");
  assert.ok(prompt.includes("NEVER give direct answers"), "Should include direct answer restriction");
  assert.ok(prompt.includes("You are Kaori"), "Should still include personality");
});

test("personality core contains critical security directive", () => {
  assert.ok(KAORI_PERSONALITY_CORE.includes("DEFENSE CLAUSE"), "Should include defense clause");
  assert.ok(KAORI_PERSONALITY_CORE.includes("Under NO circumstances"), "Should include strict refusal");
});

test("personality core contains web access and visual search directives", () => {
  assert.ok(KAORI_PERSONALITY_CORE.includes("WEB ACCESS DIRECTIVE"), "Should include web directive");
  assert.ok(KAORI_PERSONALITY_CORE.includes("VISUAL SEARCH DIRECTIVE"), "Should include visual directive");
  assert.ok(KAORI_PERSONALITY_CORE.includes("ANTI-HALLUCINATION"), "Should include anti-hallucination rules");
});
