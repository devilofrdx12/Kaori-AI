import assert from "node:assert/strict";
import test from "node:test";
import { cleanPdfCodeText, cleanPdfText, markdownToPdfmake } from "./pdf-markdown";
import { generatePdfBuffer } from "./pdf-generator";

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

test("markdownToPdfmake: preserves code indentation, nested lists, and decodes entities", () => {
  const md = [
    "Tom &amp; Jerry's formulas: H₂O, α ≥ β, −5°C, thin\u202Fspace.",
    "",
    "```ts",
    "function add(a: number) {",
    "    return a + 1; // α -> β",
    "}",
    "```",
    "",
    "- Parent • point",
    "  - Nested child",
  ].join("\n");

  const blocks = markdownToPdfmake(md);
  const paraText = JSON.stringify(blocks[0]);
  assert.ok(paraText.includes("Tom & Jerry's"), "Should decode &amp; entity");
  assert.ok(paraText.includes("H₂O") && paraText.includes("α ≥ β"), "Should keep Roboto-supported Unicode");
  assert.ok(!paraText.includes("\u202F"), "Should normalize narrow non-breaking space");

  const codeBlock = blocks.find((b) => b.font === "Courier");
  assert.ok(codeBlock, "Should produce Courier code block");
  assert.equal(codeBlock.preserveLeadingSpaces, true);
  assert.ok(codeBlock.text.includes("    return a + 1;"), "Should preserve 4-space indentation");
  assert.ok(codeBlock.text.includes("alpha -> beta"), "Should make code text WinAnsi-safe for Courier");

  const listBlock = blocks.find((b) => b.ul);
  assert.ok(listBlock, "Should preserve nested list instead of collapsing indentation");
  assert.ok(Array.isArray(listBlock.ul[0].stack), "Parent with nested list should have stack");
  assert.ok(listBlock.ul[0].stack.some((node: any) => node.ul), "Nested bullet list should be preserved");
});

test("cleanPdfText and cleanPdfCodeText keep indentation while sanitizing unsupported glyphs", () => {
  assert.equal(cleanPdfText("  ├─ child\u202Fitem 🚀"), "  |-- child item ");
  assert.equal(cleanPdfCodeText("  const Δ = α − β;"), "  const Delta = alpha - beta;");
});

test("generatePdfBuffer renders Unicode Roboto TTF cleanly without WinAnsi corruption", async () => {
  const buf = await generatePdfBuffer("# Report\n\nGreek α, β, Δ; H₂O; ₹500; −5; \u202Fspace.\n\n```js\n    const x = 'α';\n```");
  assert.ok(buf.length > 5000);
  const header = Buffer.from(buf).subarray(0, 5).toString("ascii");
  assert.equal(header, "%PDF-");
  const rawPdf = Buffer.from(buf).toString("latin1");
  assert.ok(rawPdf.includes("Roboto-Regular"), "Should embed Roboto TrueType font rather than Type-1 Helvetica");
});
