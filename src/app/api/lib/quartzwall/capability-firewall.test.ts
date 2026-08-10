import assert from "node:assert/strict";
import test from "node:test";
import { validateToolCall } from "./capability-firewall";

test("allows an explicitly requested Markdown implementation plan", () => {
  const verdict = validateToolCall(
    "create_document",
    {
      filename: "PORTFOLIO_IMPLEMENTATION_PLAN.md",
      format: "md",
      content: [
        "# Portfolio implementation plan",
        "Store passwords as bcrypt hashes.",
        "Put API_KEY=your_api_key in .env.local.",
        "Read secrets through process.env.API_KEY.",
      ].join("\n"),
    },
    "Create a full-stack Next.js portfolio implementation plan and save it as an md file."
  );

  assert.equal(verdict.allowed, true);
  assert.notEqual(verdict.verdict, "BLOCKED");
});

test("still blocks credential values embedded in generated documents", () => {
  const verdict = validateToolCall(
    "create_document",
    {
      filename: "notes.md",
      format: "md",
      content: "API_KEY=synthetic-credential-fixture",
    },
    "Create a Markdown file."
  );

  assert.equal(verdict.allowed, false);
  assert.equal(verdict.verdict, "BLOCKED");
});

test("still blocks unsafe document filenames", () => {
  const verdict = validateToolCall(
    "create_document",
    { filename: "../plan.md", format: "md", content: "# Safe plan" },
    "Create a Markdown file."
  );

  assert.equal(verdict.allowed, false);
});
