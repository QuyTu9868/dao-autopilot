import { test } from "node:test";
import assert from "node:assert/strict";
import { formatAction } from "../src/actions.js";
import { buildPrompt } from "../src/judge.js";

const ZERO = "0x0000000000000000000000000000000000000000";
const TOKEN = "0x20C623ae1dA4C32d096443097A6d523c1B2caf60";

test("đề xuất không có hành động là signal", () => {
  assert.equal(formatAction({ index: 1, target: ZERO, value: 0n }), "1. no on-chain action (signal proposal)");
});

test("hàm đã giải mã có tên contract, tham số và số lượng đọc được", () => {
  const line = formatAction({ index: 2, target: TOKEN, value: 0n, contractName: "GovToken", fn: "transfer", args: [["to", "0xabc"], ["value", 50000n * 10n ** 18n]] });
  assert.match(line, /^2\. call GovToken 0x20C6.*: transfer\(to=0xabc, value=50000000000000000000000 \(= 50000\.0 if 18 decimals\)\)$/);
});

test("chuyển ETH thuần và dữ liệu không giải mã được", () => {
  assert.equal(formatAction({ index: 1, target: TOKEN, value: 10n ** 18n }), `1. plain transfer to ${TOKEN}, sends 1.0 ETH`);
  assert.match(formatAction({ index: 3, target: TOKEN, value: 0n, raw: "0xdeadbeef" }), /undecoded data 0xdeadbeef/);
});

test("prompt có phần hành động và luật bắt lệch mô tả", () => {
  const p = buildPrompt("policy", "Fund an audit", "1. call GovToken: transfer(...)");
  assert.match(p, /<actions>\n1\. call GovToken: transfer\(\.\.\.\)\n<\/actions>/);
  assert.match(p, /Mismatch:/);
  assert.match(buildPrompt("p", "d"), /<actions>\nnone provided\n<\/actions>/);
});
