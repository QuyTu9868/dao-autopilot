import { test } from "node:test";
import assert from "node:assert/strict";
import { ethers } from "ethers";
import { checkEligibility } from "../src/drip.js";

const base = { nonce: 0, balance: 0n, ipCount: 0, total: 0 };

test("ví mới tinh được nhận", () => {
  assert.equal(checkEligibility(base), null);
});

test("ví đã có giao dịch thì không nhận", () => {
  assert.match(checkEligibility({ ...base, nonce: 1 }), /already made transactions/);
});

test("ví đã có đủ ETH thì không nhận", () => {
  assert.match(checkEligibility({ ...base, balance: ethers.parseEther("0.001") }), /already has enough/);
  assert.equal(checkEligibility({ ...base, balance: ethers.parseEther("0.0004") }), null);
});

test("hạn mức theo IP và theo ngày", () => {
  assert.match(checkEligibility({ ...base, ipCount: 3 }), /your network/);
  assert.match(checkEligibility({ ...base, total: 40 }), /budget is used up/);
});
