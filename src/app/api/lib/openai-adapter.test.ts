import test from "node:test";
import assert from "node:assert/strict";
import { convertMessages } from "./openai-adapter";
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
