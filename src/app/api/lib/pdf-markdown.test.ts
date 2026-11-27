import assert from "node:assert/strict";
import test from "node:test";
import { markdownToPdfmake } from "./pdf-markdown";

test("markdownToPdfmake: strips unsafe non-HTTP links while keeping https links", () => {
  const blocks = markdownToPdfmake(
    "Click [evil](javascript:alert(1)) or [local](file:///etc/passwd) or [safe](https://example.com)."
  );
  const json = JSON.stringify(blocks);
  assert.ok(!json.includes("javascript:"), "Must strip javascript: links");
  assert.ok(!json.includes("file://"), "Must strip file:// links");
  assert.ok(json.includes("https://example.com"), "Must preserve https:// links");
});

test("markdownToPdfmake: renders blockquotes using stack instead of nesting block objects in text", () => {
  const blocks = markdownToPdfmake("> Quoted line 1\n>\n> Quoted line 2");
  assert.equal(blocks.length, 1);
  assert.ok(Array.isArray(blocks[0].stack), "Blockquote should use stack array");
  assert.equal(blocks[0].text, undefined);
});

test("markdownToPdfmake: normalizes irregular markdown table rows without throwing", () => {
  const irregularTable = [
    "| Col A | Col B | Col C |",
    "| --- | --- | --- |",
    "| Only one cell |",
    "| One | Two | Three | Extra Four |",
  ].join("\n");

  const blocks = markdownToPdfmake(irregularTable);
  const tableBlock = blocks.find((b) => b.table);
  assert.ok(tableBlock, "Should produce a table block");
  assert.equal(tableBlock.table.body[0].length, 3);
  assert.equal(tableBlock.table.body[1].length, 3);
  assert.equal(tableBlock.table.body[2].length, 3);
});
