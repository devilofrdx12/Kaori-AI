import assert from "node:assert/strict";
import test from "node:test";
import { resolveModelForFeatureMode } from "./model-routing";

const GROQ_MODEL = "openai/gpt-oss-120b";

test("normal chat preserves the selected model", () => {
  assert.equal(resolveModelForFeatureMode(GROQ_MODEL, "auto"), GROQ_MODEL);
});

test("web and image search preserve the selected model", () => {
  assert.equal(resolveModelForFeatureMode(GROQ_MODEL, "web"), GROQ_MODEL);
  assert.equal(resolveModelForFeatureMode(GROQ_MODEL, "council"), GROQ_MODEL);
});

test("deep research uses its specialist model while reasoning summaries preserve selection", () => {
  assert.equal(
    resolveModelForFeatureMode(GROQ_MODEL, "deep"),
    "gemini-3.8-flash"
  );
  assert.equal(resolveModelForFeatureMode(GROQ_MODEL, "thinking"), GROQ_MODEL);
});
