import assert from "node:assert/strict";
import test from "node:test";
import { validateMemoryInput, validateProjectInput } from "./validation";

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
