/**
 * ISTQB Test Suite: Memory DTO & Tag Parsing (Extended)
 *
 * Techniques applied:
 *   - Equivalence Partitioning (valid/invalid JSON, array/object/string)
 *   - Error Guessing (edge cases in real-world storage)
 *
 * Test Basis: memory-dto.ts — parseMemoryTags, memoryDto
 */

import assert from "node:assert/strict";
import test from "node:test";
import { parseMemoryTags, memoryDto } from "./memory-dto";
import type { DBUserMemory } from "./db";

// ════════════════════════════════════════════════
// parseMemoryTags — EP + Error Guessing
// ════════════════════════════════════════════════

test("EP: valid JSON array of strings returns string tags only", () => {
  assert.deepEqual(parseMemoryTags('["coding","ai","research"]'), ["coding", "ai", "research"]);
});

test("EP: mixed-type array filters out non-strings", () => {
  assert.deepEqual(parseMemoryTags('[1, "valid", null, true, "also-valid"]'), ["valid", "also-valid"]);
});

test("EP: empty array returns empty array", () => {
  assert.deepEqual(parseMemoryTags("[]"), []);
});

test("EP: JSON object returns empty array (not an array)", () => {
  assert.deepEqual(parseMemoryTags('{"key":"value"}'), []);
});

test("EP: non-JSON string returns empty array", () => {
  assert.deepEqual(parseMemoryTags("not-json-at-all"), []);
  assert.deepEqual(parseMemoryTags(""), []);
});

test("EP: nested arrays are filtered (not strings)", () => {
  assert.deepEqual(parseMemoryTags('[["nested"],"flat"]'), ["flat"]);
});

// ════════════════════════════════════════════════
// memoryDto — transformation correctness
// ════════════════════════════════════════════════

test("memoryDto transforms DBUserMemory to API format", () => {
  const memory: DBUserMemory = {
    id: "mem-123",
    user_id: "user-456",
    content: "User prefers dark mode",
    tags: '["preference","ui"]',
    source_conv_id: "conv-789",
    category: "preference",
    scope: "global",
    status: "approved",
    project_id: null,
    source_type: "auto",
    confidence: 0.95,
    importance: 0.7,
    sensitivity: "normal",
    embedding: null,
    embedding_model: null,
    created_at: 1696000000,
    updated_at: 1696100000,
    expires_at: null,
  };

  const dto = memoryDto(memory);

  assert.equal(dto.id, "mem-123");
  assert.equal(dto.content, "User prefers dark mode");
  assert.deepEqual(dto.tags, ["preference", "ui"]);
  assert.equal(dto.category, "preference");
  assert.equal(dto.scope, "global");
  assert.equal(dto.status, "approved");
  assert.equal(dto.projectId, null);
  assert.equal(dto.sourceType, "auto");
  assert.equal(dto.sourceConversationId, "conv-789");
  assert.equal(dto.expiresAt, null);
  assert.equal(typeof dto.createdAt, "string"); // ISO string
  assert.equal(typeof dto.updatedAt, "string");
});

test("memoryDto formats expires_at when present", () => {
  const memory: DBUserMemory = {
    id: "mem-exp",
    user_id: "user-456",
    content: "Temporary note",
    tags: "[]",
    source_conv_id: null,
    category: "fact",
    scope: "global",
    status: "approved",
    project_id: null,
    source_type: "manual",
    confidence: 1.0,
    importance: 0.5,
    sensitivity: "normal",
    embedding: null,
    embedding_model: null,
    created_at: 1696000000,
    updated_at: 1696000000,
    expires_at: 1700000000,
  };

  const dto = memoryDto(memory);
  assert.ok(dto.expiresAt !== null);
  assert.ok(typeof dto.expiresAt === "string");
  assert.ok(dto.expiresAt!.includes("2023")); // Unix 1700000000 is in 2023
});

test("memoryDto handles malformed tags gracefully", () => {
  const memory: DBUserMemory = {
    id: "mem-bad-tags",
    user_id: "user-456",
    content: "Bad tags memory",
    tags: "not-valid-json",
    source_conv_id: null,
    category: "fact",
    scope: "global",
    status: "approved",
    project_id: null,
    source_type: "manual",
    confidence: 1.0,
    importance: 0.5,
    sensitivity: "normal",
    embedding: null,
    embedding_model: null,
    created_at: 1696000000,
    updated_at: 1696000000,
    expires_at: null,
  };

  const dto = memoryDto(memory);
  assert.deepEqual(dto.tags, []); // Gracefully returns empty array
});
