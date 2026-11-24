// Measures the latency of both rounds on Base Sepolia and records each transaction hash.
// Usage: node --env-file=.env scripts/measure.mjs [runs, default 5]
// Round 1: Governor.propose -> Hub.ReviewRequested (Reactive reads the event, then calls back).
// Round 2: Hub.VerdictSubmitted -> Voter.Voted (Reactive reads the event, then calls back to vote).
// Needs the AI service running and the dev wallet Voter to have a policy that supports security spending.
import { ethers } from "../ai-service/node_modules/ethers/lib.esm/index.js";
import { judge } from "../ai-service/src/judge.js";
import fs from "node:fs";

const N = Number(process.argv[2] || 5);
const rpc = process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org";
const provider = new ethers.JsonRpcProvider(rpc);
let pk = process.env.DEV_PRIVATE_KEY;
if (!pk.startsWith("0x")) pk = "0x" + pk;
const wallet = new ethers.Wallet(pk, provider);

const governor = new ethers.Contract(
  process.env.GOVERNOR_ADDRESS,
  [
    "function propose(address[],uint256[],bytes[],string) returns (uint256)",
    "function hashProposal(address[],uint256[],bytes[],bytes32) view returns (uint256)",
  ],
  wallet,
);
const hubAddr = process.env.HUB_ADDRESS;
const hub = new ethers.Contract(hubAddr, ["function voterOf(address) view returns (address)"], provider);
const T_REVIEW = ethers.id("ReviewRequested(uint256)");
const T_VERDICT = ethers.id("VerdictSubmitted(address,uint256,uint8,uint8,string)");
const T_VOTED = ethers.id("Voted(uint256,uint8,bool)");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tsCache = new Map();
async function blockMs(n) {
  if (!tsCache.has(n)) {
    const b = await provider.send("eth_getBlockByNumber", ["0x" + n.toString(16), false]);
    tsCache.set(n, BigInt(b.timestampMs));
  }
  return tsCache.get(n);
}
const topicOf = (v) => ethers.zeroPadValue(ethers.toBeHex(v), 32);

async function one(i, voterAddr) {
  const targets = [ethers.ZeroAddress];
  const values = [0n];
  const calldatas = ["0x"];
  const desc = `Fund an external security audit of the core contracts, measurement run ${i} (${Date.now()})`;
  const tx = await governor.propose(targets, values, calldatas, desc);
  const rc = await tx.wait();
  const pid = await governor.hashProposal(targets, values, calldatas, ethers.id(desc));
  const created = { hash: tx.hash, block: rc.blockNumber, ms: await blockMs(rc.blockNumber) };

  const found = {};
  let next = rc.blockNumber;
  const deadline = Date.now() + 240_000;
  while (Date.now() < deadline && !(found.review && found.verdict && found.voted)) {
    const head = await provider.getBlockNumber();
    while (next <= head && !(found.review && found.verdict && found.voted)) {
      const to = Math.min(head, next + 149);
      const [hubLogs, voterLogs] = await Promise.all([
        provider.getLogs({ address: hubAddr, fromBlock: next, toBlock: to }),
        provider.getLogs({ address: voterAddr, fromBlock: next, toBlock: to }),
      ]);
      for (const l of hubLogs) {
        if (l.topics[0] === T_REVIEW && l.topics[1] === topicOf(pid)) found.review = l;
        if (l.topics[0] === T_VERDICT && l.topics[2] === topicOf(pid) && l.topics[1].toLowerCase() === ethers.zeroPadValue(voterAddr, 32).toLowerCase()) found.verdict = l;
      }
      for (const l of voterLogs) if (l.topics[0] === T_VOTED && l.topics[1] === topicOf(pid)) found.voted = l;
      next = to + 1;
    }
    await sleep(2000);
  }
  if (!(found.review && found.verdict && found.voted)) throw new Error(`run ${i}: missing events`);
  const ev = async (l) => ({ hash: l.transactionHash, block: l.blockNumber, ms: await blockMs(l.blockNumber) });
  const review = await ev(found.review);
  const verdict = await ev(found.verdict);
  const voted = await ev(found.voted);
  return {
    run: i,
    pid: pid.toString(),
    created, review, verdict, voted,
    round1Ms: Number(review.ms - created.ms),
    round2Ms: Number(voted.ms - verdict.ms),
    totalMs: Number(voted.ms - created.ms),
  };
}

const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

async function geminiLatency(policy, runs = 5) {
  const out = [];
  for (let i = 0; i < runs; i++) {
    const t = Date.now();
    await judge({
      apiKey: process.env.LLM_API_KEY,
      model: process.env.GEMINI_MODEL || "gemini-3.1-flash-lite",
      policy,
      description: `Allocate ${i + 2} percent of the treasury to a bug bounty program`,
    });
    out.push(Date.now() - t);
  }
  return out;
}

const voterAddr = await hub.voterOf(wallet.address);
const results = [];
for (let i = 1; i <= N; i++) {
  console.log(`run ${i}/${N}...`);
  results.push(await one(i, voterAddr));
  console.log(JSON.stringify({ r1: results.at(-1).round1Ms, r2: results.at(-1).round2Ms, total: results.at(-1).totalMs }));
}
const gem = await geminiLatency("Support spending on security, audits and bug bounties. Oppose cuts to the security budget.");

const r1 = results.map((r) => r.round1Ms);
const r2 = results.map((r) => r.round2Ms);
const md = [];
md.push(`# Latency measurements (${new Date().toISOString().slice(0, 10)}, Base Sepolia + Reactive Lasna)`);
md.push("");
md.push(`Runs: ${N}. Times come from the timestampMs field of the block that contains each transaction (Base Sepolia blocks are 200 ms).`);
md.push("");
md.push("| Step | Min | Median | Max |");
md.push("|---|---|---|---|");
md.push(`| Round 1: ProposalCreated to ReviewRequested (Reactive callback) | ${Math.min(...r1)} ms | ${median(r1)} ms | ${Math.max(...r1)} ms |`);
md.push(`| Round 2: VerdictSubmitted to Voted (Reactive callback casts the vote) | ${Math.min(...r2)} ms | ${median(r2)} ms | ${Math.max(...r2)} ms |`);
md.push(`| Gemini judging one proposal (${gem.length} calls) | ${Math.min(...gem)} ms | ${median(gem)} ms | ${Math.max(...gem)} ms |`);
md.push("");
md.push("From posting a proposal to the vote being recorded (includes the 60 second voting delay set in the Governor): " + results.map((r) => (r.totalMs / 1000).toFixed(1) + " s").join(", ") + ".");
md.push("");
md.push("## Transaction hashes per run");
md.push("");
md.push("| Run | Propose | ReviewRequested callback | submitVerdict | Voted (callback vote) | Round 1 | Round 2 |");
md.push("|---|---|---|---|---|---|---|");
for (const r of results) {
  md.push(`| ${r.run} | ${r.created.hash} | ${r.review.hash} | ${r.verdict.hash} | ${r.voted.hash} | ${r.round1Ms} ms | ${r.round2Ms} ms |`);
}
fs.mkdirSync("submission", { recursive: true });
fs.writeFileSync("submission/measurements.md", md.join("\n") + "\n");
console.log(md.join("\n"));
