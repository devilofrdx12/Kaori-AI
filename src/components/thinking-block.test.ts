import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ThinkingBlock } from "./message-row";
import { ToolResultData } from "./types";

test("word count calculation logic", () => {
  const getWordCount = (content?: string) => (content || "").split(/\s+/).filter(Boolean).length;

  assert.equal(getWordCount(undefined), 0);
  assert.equal(getWordCount(""), 0);
  assert.equal(getWordCount("   "), 0);
  assert.equal(getWordCount("one"), 1);
  assert.equal(getWordCount("Thinking deeply about this query..."), 5);
  assert.equal(getWordCount("  Multiple   spaces \n and \t tabs "), 4);
});

test("ThinkingBlock renders correct word count badge", () => {
  // Empty content -> no word badge
  const htmlEmpty = renderToStaticMarkup(
    React.createElement(ThinkingBlock, { content: "", isStreaming: false })
  );
  assert.ok(!htmlEmpty.includes("words"), "Empty content should not render word badge");

  // Content with 5 words -> '5 words' badge
  const html5 = renderToStaticMarkup(
    React.createElement(ThinkingBlock, { content: "One two three four five", isStreaming: false })
  );
  assert.ok(html5.includes("5 words"), "Should render '5 words'");
});

test("ThinkingBlock label changes based on isStreaming", () => {
  // When isStreaming=true -> 'Thinking…'
  const htmlStreaming = renderToStaticMarkup(
    React.createElement(ThinkingBlock, { content: "Analyzing", isStreaming: true })
  );
  assert.ok(htmlStreaming.includes("Thinking…"), "Should show 'Thinking…' when isStreaming=true");
  assert.ok(!htmlStreaming.includes("Thought process"), "Should not show 'Thought process' when streaming");
  assert.ok(htmlStreaming.includes("thinking-shimmer"), "Should have shimmer effect when streaming");

  // When isStreaming=false -> 'Thought process'
  const htmlFinished = renderToStaticMarkup(
    React.createElement(ThinkingBlock, { content: "Done analyzing", isStreaming: false })
  );
  assert.ok(htmlFinished.includes("Thought process"), "Should show 'Thought process' when isStreaming=false");
  assert.ok(!htmlFinished.includes("Thinking…"), "Should not show 'Thinking…' when finished");
});

test("ThinkingBlock auto-expands when isStreaming=true", () => {
  // isStreaming=true -> expanded (max-h-[600px] opacity-100)
  const htmlStreaming = renderToStaticMarkup(
    React.createElement(ThinkingBlock, { content: "Deliberating...", isStreaming: true })
  );
  assert.ok(htmlStreaming.includes("max-h-[600px]"), "Should be expanded when isStreaming=true");
  assert.ok(htmlStreaming.includes("opacity-100"), "Should have opacity-100 when isStreaming=true");

  // isStreaming=false -> collapsed (max-h-0 opacity-0)
  const htmlCollapsed = renderToStaticMarkup(
    React.createElement(ThinkingBlock, { content: "Deliberating...", isStreaming: false })
  );
  assert.ok(htmlCollapsed.includes("max-h-0"), "Should be collapsed when isStreaming=false");
  assert.ok(htmlCollapsed.includes("opacity-0"), "Should have opacity-0 when isStreaming=false");
});

test("ThinkingBlock web search badge logic and rendering", () => {
  // No tool results -> no web search badge
  const htmlNoTools = renderToStaticMarkup(
    React.createElement(ThinkingBlock, { content: "Thinking", isStreaming: false })
  );
  assert.ok(!htmlNoTools.includes("Searched web"), "Should not render 'Searched web' without tool results");

  // toolResults with web_search
  const webSearchTools: ToolResultData[] = [
    { toolName: "web_search", result: "Search results for query" },
  ];
  const htmlWebSearch = renderToStaticMarkup(
    React.createElement(ThinkingBlock, {
      content: "Thinking",
      isStreaming: false,
      toolResults: webSearchTools,
    })
  );
  assert.ok(htmlWebSearch.includes("Searched web"), "Should render 'Searched web' badge for web_search");

  // toolResults with web_fetch
  const webFetchTools: ToolResultData[] = [
    { toolName: "web_fetch", result: "Fetched content" },
  ];
  const htmlWebFetch = renderToStaticMarkup(
    React.createElement(ThinkingBlock, {
      content: "Thinking",
      isStreaming: false,
      toolResults: webFetchTools,
    })
  );
  assert.ok(htmlWebFetch.includes("Searched web"), "Should render 'Searched web' badge for web_fetch");

  // Other tool results (e.g., create_document) should NOT trigger 'Searched web'
  const docTools: ToolResultData[] = [
    { toolName: "create_document", result: "Doc created" },
  ];
  const htmlDoc = renderToStaticMarkup(
    React.createElement(ThinkingBlock, {
      content: "Thinking",
      isStreaming: false,
      toolResults: docTools,
    })
  );
  assert.ok(!htmlDoc.includes("Searched web"), "Should NOT render 'Searched web' badge for non-web tools");
});

test("ThinkingBlock content rendering and streaming cursor", () => {
  // Content text renders correctly
  const html = renderToStaticMarkup(
    React.createElement(ThinkingBlock, {
      content: "Here is step 1\nStep 2 follows",
      isStreaming: false,
    })
  );
  assert.ok(html.includes("Here is step 1\nStep 2 follows"), "Should contain raw thought content");
  assert.ok(html.includes("font-mono"), "Should render thought text with font-mono class");

  // Pulsing cursor when streaming
  const htmlStreaming = renderToStaticMarkup(
    React.createElement(ThinkingBlock, {
      content: "Streaming now...",
      isStreaming: true,
    })
  );
  assert.ok(htmlStreaming.includes("animate-pulse"), "Should render pulse indicator when streaming");
  assert.ok(htmlStreaming.includes("thinking-content-stream"), "Should have streaming content class");
});

test("ThinkingBlock renders tool results inside thinking block", () => {
  const tools: ToolResultData[] = [
    { toolName: "web_search", result: "Found 5 sources" },
    { toolName: "custom_analyzer", result: "Analysis complete" },
  ];
  const html = renderToStaticMarkup(
    React.createElement(ThinkingBlock, {
      content: "Evaluating sources",
      isStreaming: false,
      toolResults: tools,
    })
  );
  // WebSearchResultCard renders "Searched the web"
  assert.ok(html.includes("Searched the web"), "Should render WebSearchResultCard inside thinking block");
  // Generic tool result card renders tool name
  assert.ok(html.includes("custom_analyzer"), "Should render generic tool name inside thinking block");
});

test("auto-expand state transition simulation", () => {
  // Pure logic simulation of the ThinkingBlock state machine:
  // Initial state: open = isStreaming ? true : false
  // On isStreaming transition from false to true -> open = true
  class ThinkingBlockLogic {
    open: boolean;
    prevIsStreaming: boolean | undefined;

    constructor(initialStreaming?: boolean) {
      this.open = initialStreaming ? true : false;
      this.prevIsStreaming = initialStreaming;
    }

    updateStreaming(isStreaming?: boolean) {
      if (isStreaming !== this.prevIsStreaming) {
        this.prevIsStreaming = isStreaming;
        if (isStreaming) {
          this.open = true;
        }
      }
    }

    toggle() {
      this.open = !this.open;
    }
  }

  // Case 1: Initial load not streaming -> closed
  const block1 = new ThinkingBlockLogic(false);
  assert.equal(block1.open, false);

  // Case 2: Initial load streaming -> open
  const block2 = new ThinkingBlockLogic(true);
  assert.equal(block2.open, true);

  // Case 3: Streaming ends -> remains open until user collapses it
  block2.updateStreaming(false);
  assert.equal(block2.open, true, "Should stay open after streaming completes");
  block2.toggle();
  assert.equal(block2.open, false, "User can collapse it");

  // Case 4: Starts closed, then streaming starts -> auto-expands
  const block3 = new ThinkingBlockLogic(false);
  assert.equal(block3.open, false);
  block3.updateStreaming(true);
  assert.equal(block3.open, true, "Should auto-expand when streaming starts");
});
