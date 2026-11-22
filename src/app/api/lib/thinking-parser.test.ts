import assert from "node:assert/strict";
import test from "node:test";
import { createReasoningSummaryParser } from "./thinking-parser";

test("parses <think> tags into summary and answer", () => {
  let summary = "";
  let answer = "";
  const parser = createReasoningSummaryParser(
    (s) => { summary += s; },
    (a) => { answer += a; }
  );

  parser.push("<think>Let me analyze the problem first.</think>Here is the answer!");
  parser.flush();

  assert.equal(summary, "Let me analyze the problem first.");
  assert.equal(answer, "Here is the answer!");
});

test("parses <reasoning_summary> and <final_answer> tags", () => {
  let summary = "";
  let answer = "";
  const parser = createReasoningSummaryParser(
    (s) => { summary += s; },
    (a) => { answer += a; }
  );

  parser.push("<reasoning_summary>Reviewing codebase.</reasoning_summary><final_answer>All clean.</final_answer>");
  parser.flush();

  assert.equal(summary, "Reviewing codebase.");
  assert.equal(answer, "All clean.");
});

test("passes plain text straight through without delay", () => {
  let summary = "";
  let answer = "";
  const parser = createReasoningSummaryParser(
    (s) => { summary += s; },
    (a) => { answer += a; }
  );

  parser.push("Hello! How can I help you today?");
  parser.flush();

  assert.equal(summary, "");
  assert.equal(answer, "Hello! How can I help you today?");
});

test("handles chunked streaming of <think> tags", () => {
  let summary = "";
  let answer = "";
  const parser = createReasoningSummaryParser(
    (s) => { summary += s; },
    (a) => { answer += a; }
  );

  parser.push("<th");
  parser.push("ink>I am");
  parser.push(" thinking deeply");
  parser.push("</th");
  parser.push("ink>Hello world");
  parser.flush();

  assert.equal(summary, "I am thinking deeply");
  assert.equal(answer, "Hello world");
});
