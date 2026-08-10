import assert from "node:assert/strict";
import test from "node:test";
import { readJsonBodyWithLimit, RequestBodyError } from "./request-body";

test("reads a bounded JSON object", async () => {
  const request = new Request("https://example.test", {
    method: "POST",
    body: JSON.stringify({ message: "hello" }),
  });
  assert.deepEqual(await readJsonBodyWithLimit(request, 1024), { message: "hello" });
});

test("rejects malformed and non-object JSON", async () => {
  await assert.rejects(
    readJsonBodyWithLimit(new Request("https://example.test", { method: "POST", body: "{" }), 1024),
    (error: unknown) => error instanceof RequestBodyError && error.status === 400
  );
  await assert.rejects(
    readJsonBodyWithLimit(new Request("https://example.test", { method: "POST", body: "[]" }), 1024),
    (error: unknown) => error instanceof RequestBodyError && error.status === 400
  );
});

test("rejects request bodies above the byte limit", async () => {
  await assert.rejects(
    readJsonBodyWithLimit(
      new Request("https://example.test", { method: "POST", body: JSON.stringify({ value: "x".repeat(100) }) }),
      32
    ),
    (error: unknown) => error instanceof RequestBodyError && error.status === 413
  );
});
