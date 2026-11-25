import { test } from "node:test";
import assert from "node:assert/strict";
import { judge } from "../src/judge.js";

const ok = (verdict) => ({
  ok: true,
  status: 200,
  json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ claimed: "", actual: "", verdict, confidence: 90, reason: "r" }) }] } }] }),
});
const fail = (status) => ({ ok: false, status, json: async () => ({}) });

function mockFetch(responses) {
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(url.match(/models\/([^:]+):/)[1]);
    return responses.shift();
  };
  return calls;
}

const base = { apiKey: "k", policy: "p", description: "d", delays: [1, 1, 1] };

test("thử lại khi model quá tải rồi thành công", async () => {
  const calls = mockFetch([fail(503), fail(429), ok("for")]);
  const r = await judge({ ...base, model: "main" });
  assert.equal(r.verdict, "for");
  assert.equal(r.model, "main");
  assert.deepEqual(calls, ["main", "main", "main"]);
});

test("model chính lỗi hết lượt thì chuyển sang model dự phòng", async () => {
  const calls = mockFetch([fail(503), fail(503), fail(503), fail(503), ok("against")]);
  const r = await judge({ ...base, model: "main", fallbackModel: "backup" });
  assert.equal(r.verdict, "against");
  assert.equal(r.model, "backup");
  assert.equal(r.fallbackFrom, "main");
  assert.deepEqual(calls, ["main", "main", "main", "main", "backup"]);
});

test("lỗi không tạm thời (400) thì không thử lại model chính", async () => {
  const calls = mockFetch([fail(400), ok("skip")]);
  const r = await judge({ ...base, model: "main", fallbackModel: "backup" });
  assert.equal(r.model, "backup");
  assert.deepEqual(calls, ["main", "backup"]);
});

test("không có dự phòng thì ném lỗi, không bịa phán quyết", async () => {
  mockFetch([fail(503), fail(503), fail(503), fail(503)]);
  await assert.rejects(judge({ ...base, model: "main" }), /HTTP 503/);
});
