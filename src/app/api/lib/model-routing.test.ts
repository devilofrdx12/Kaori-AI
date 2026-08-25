import assert from "node:assert/strict";
import test from "node:test";
import { resolveModelForFeatureMode } from "./model-routing";

const GROQ_MODEL = "openai/gpt-oss-120b";

test("normal chat preserves the selected model", () => {
  assert.equal(resolveModelForFeatureMode(GROQ_MODEL, "auto"), GROQ_MODEL);
});

test("web and image search preserve the selected model", () => {
  assert.equal(resolveModelForFeatureMode(GROQ_MODEL, "web"), GROQ_MODEL);
});

test("explicit specialist modes use their advertised models", () => {
  assert.equal(
    resolveModelForFeatureMode(GROQ_MODEL, "deep"),
    "nvidia/nemotron-3-ultra-550b-a55b"
  );
  assert.equal(resolveModelForFeatureMode(GROQ_MODEL, "thinking"), "nvidia/llama-3.1-nemotron-70b-instruct");
});
