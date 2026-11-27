import test from "node:test";
import assert from "node:assert/strict";
import { convertMessages, createOpenAiToAnthropicTransform } from "./openai-adapter";
import { KaoriMessage } from "./core-types";

test("convertMessages: converts simple text user message", () => {
  const messages: KaoriMessage[] = [
    { role: "user", content: "Hello world" }
  ];
  const result = convertMessages(messages);
  assert.equal(result.length, 1);
  assert.deepEqual(result[0], { role: "user", content: "Hello world" });
});

test("convertMessages: converts assistant tool_use without extra_content", () => {
  const messages: KaoriMessage[] = [
    {
      role: "assistant",
      content: [
        {
          type: "tool_use",
          id: "call_123",
          name: "create_document",
          input: { filename: "report.pdf", format: "pdf", content: "test" }
        }
      ]
    }
  ];
  const result = convertMessages(messages);
  assert.equal(result.length, 1);
  assert.equal(result[0].role, "assistant");
  assert.equal(result[0].content, null);
  assert.equal(result[0].tool_calls.length, 1);
  assert.deepEqual(result[0].tool_calls[0], {
    id: "call_123",
    type: "function",
    function: {
      name: "create_document",
      arguments: JSON.stringify({ filename: "report.pdf", format: "pdf", content: "test" })
    }
  });
});

test("convertMessages: preserves extra_content on tool_use for Google Gemini", () => {
  const googleExtraContent = {
    google: {
      thought_signature: "sig_abc123xyz"
    }
  };
  const messages: KaoriMessage[] = [
    {
      role: "assistant",
      content: [
        {
          type: "tool_use",
          id: "call_gemini_456",
          name: "create_document",
          input: { filename: "notes.pdf", format: "pdf", content: "Notes content" },
          extra_content: googleExtraContent
        }
      ]
    }
  ];
  const result = convertMessages(messages);
  assert.equal(result.length, 1);
  assert.equal(result[0].role, "assistant");
  assert.equal(result[0].content, null);
  assert.equal(result[0].tool_calls.length, 1);
  assert.deepEqual(result[0].tool_calls[0].extra_content, googleExtraContent);
  assert.equal(result[0].tool_calls[0].function.name, "create_document");
});

test("convertMessages: converts tool_result to tool role message with tool_call_id", () => {
  const messages: KaoriMessage[] = [
    {
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: "call_gemini_456",
          content: JSON.stringify({ success: true, docId: "doc_999" })
        }
      ]
    }
  ];
  const result = convertMessages(messages);
  assert.equal(result.length, 1);
  assert.deepEqual(result[0], {
    role: "tool",
    tool_call_id: "call_gemini_456",
    content: JSON.stringify({ success: true, docId: "doc_999" })
  });
});

test("convertMessages: converts multi-turn chat with text, tool_use, and tool_result", () => {
  const googleExtraContent = {
    google: {
      thought_signature: "sig_def456"
    }
  };
  const messages: KaoriMessage[] = [
    { role: "user", content: "Create a PDF of meeting minutes" },
    {
      role: "assistant",
      content: [
        { type: "text", text: "I'll create that PDF for you right away." },
        {
          type: "tool_use",
          id: "call_minutes_789",
          name: "create_document",
          input: { filename: "meeting_minutes.pdf", format: "pdf", content: "# Meeting Minutes" },
          extra_content: googleExtraContent
        }
      ]
    },
    {
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: "call_minutes_789",
          content: "Document created successfully! Download it here: [meeting_minutes.pdf](/api/download/doc-abc)"
        }
      ]
    }
  ];
  const result = convertMessages(messages);
  assert.equal(result.length, 3);
  assert.equal(result[0].role, "user");
  assert.equal(result[0].content, "Create a PDF of meeting minutes");

  assert.equal(result[1].role, "assistant");
  assert.equal(result[1].content, "I'll create that PDF for you right away.");
  assert.equal(result[1].tool_calls.length, 1);
  assert.deepEqual(result[1].tool_calls[0].extra_content, googleExtraContent);

  assert.equal(result[2].role, "tool");
  assert.equal(result[2].tool_call_id, "call_minutes_789");
});

test("createOpenAiToAnthropicTransform: preserves parallel tool calls by index and flushes trailing line", async () => {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const sseChunks = [
    `data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, id: "call_0", function: { name: "web_search", arguments: '{"que' } }] } }] })}\n\n`,
    `data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 1, id: "call_1", function: { name: "web_fetch", arguments: '{"ur' } }] } }] })}\n\n`,
    `data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: 'ry":"kaori"}' } }] } }] })}\n\n`,
    `data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 1, function: { arguments: 'l":"https://example.com"}' } }] } }] })}\n\n`,
    // Deliberately omit trailing newline on final event to test flush()
    `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "tool_calls" }] })}`,
  ];

  const inputStream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of sseChunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });

  const reader = inputStream.pipeThrough(createOpenAiToAnthropicTransform()).getReader();
  let combined = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    combined += decoder.decode(value, { stream: true });
  }

  const events = combined
    .split("\n")
    .filter((line) => line.startsWith("data: ") && line !== "data: [DONE]")
    .map((line) => JSON.parse(line.slice(6)));

  const starts = events.filter((e) => e.type === "content_block_start");
  assert.equal(starts.length, 2);
  assert.equal(starts[0].index, 0);
  assert.equal(starts[0].content_block.name, "web_search");
  assert.equal(starts[1].index, 1);
  assert.equal(starts[1].content_block.name, "web_fetch");

  const args0 = events
    .filter((e) => e.type === "content_block_delta" && e.index === 0)
    .map((e) => e.delta.partial_json)
    .join("");
  const args1 = events
    .filter((e) => e.type === "content_block_delta" && e.index === 1)
    .map((e) => e.delta.partial_json)
    .join("");

  assert.deepEqual(JSON.parse(args0), { query: "kaori" });
  assert.deepEqual(JSON.parse(args1), { url: "https://example.com" });
  assert.ok(events.some((e) => e.type === "message_delta" && e.delta?.stop_reason === "tool_use"));
});
