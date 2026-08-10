import assert from "node:assert/strict";
import test from "node:test";
import {
  modelSupportsVision,
  validateMemoryInput,
  validateModel,
  validateProjectInput,
} from "./validation";
import { parseMemoryTags } from "./memory-dto";

test("project input is normalized and bounded", () => {
  assert.deepEqual(
    validateProjectInput({
      name: "  Research   Lab  ",
      description: "  Sources\n and notes ",
      instructions: "  Prefer primary sources.  ",
    }),
    {
      name: "Research Lab",
      description: "Sources and notes",
      instructions: "Prefer primary sources.",
    }
  );
  assert.throws(() => validateProjectInput({ name: "" }), /required/);
  assert.throws(() => validateProjectInput({ name: "x".repeat(81) }), /too long/);
});

test("memory input removes duplicate tags and normalizes their case", () => {
  assert.deepEqual(
    validateMemoryInput({ content: "  I prefer concise answers. ", tags: ["Style", " style ", "Work"] }),
    { content: "I prefer concise answers.", tags: ["style", "work"] }
  );
  assert.throws(() => validateMemoryInput({ content: "" }), /required/);
  assert.throws(
    () => validateMemoryInput({ content: "valid", tags: Array.from({ length: 11 }, (_, i) => `tag-${i}`) }),
    /Too many/
  );
});

test("memory and project controls reject embedded null characters safely", () => {
  assert.equal(validateMemoryInput({ content: "hello\u0000world" }).content, "helloworld");
  assert.equal(validateProjectInput({ name: "hello\u0000world" }).name, "hello world");
});

test("memory tags tolerate legacy or malformed storage", () => {
  assert.deepEqual(parseMemoryTags('["style","work",42]'), ["style", "work"]);
  assert.deepEqual(parseMemoryTags("not-json"), []);
  assert.deepEqual(parseMemoryTags('{"tag":"style"}'), []);
});

test("vision capability is enforced from a server-owned model list", () => {
  assert.equal(modelSupportsVision("gemini-2.5-flash"), true);
  assert.equal(modelSupportsVision("llama-3.2-90b-vision-preview"), false);
  assert.equal(modelSupportsVision("llama-3.3-70b-versatile"), false);
  assert.equal(modelSupportsVision("nvidia/nemotron-3-ultra-550b-a55b"), false);
});

test("GLM 5.2 is accepted as a supported text reasoning model", () => {
  assert.equal(validateModel("z-ai/glm-5.2"), "z-ai/glm-5.2");
  assert.equal(modelSupportsVision("z-ai/glm-5.2"), false);
});
