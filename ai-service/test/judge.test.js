import { test } from "node:test";
import assert from "node:assert/strict";
import { parseVerdict, buildPrompt } from "../src/judge.js";

test("parse JSON thuần", () => {
  const r = parseVerdict('{"verdict":"for","confidence":88,"reason":"fits"}');
  assert.deepEqual(r, { verdict: "for", confidence: 88, reason: "fits" });
});

test("parse JSON bọc trong code fence", () => {
  const r = parseVerdict('```json\n{"verdict":"Against","confidence":"75.4","reason":"no"}\n```');
  assert.equal(r.verdict, "against");
  assert.equal(r.confidence, 75);
});

test("kẹp confidence vào 0..100 và cắt reason", () => {
  const r = parseVerdict(JSON.stringify({ verdict: "skip", confidence: 250, reason: "x".repeat(500) }));
  assert.equal(r.confidence, 100);
  assert.equal(r.reason.length, 280);
});

test("từ chối đầu ra hỏng", () => {
  assert.equal(parseVerdict("not json"), null);
  assert.equal(parseVerdict('{"verdict":"maybe","confidence":50,"reason":"x"}'), null);
  assert.equal(parseVerdict('{"verdict":"for","reason":"x"}'), null);
  assert.equal(parseVerdict(undefined), null);
});

test("prompt cắt input quá dài", () => {
  const p = buildPrompt("p".repeat(5000), "d".repeat(9000));
  assert.ok(p.length < 7000);
});
