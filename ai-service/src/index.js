// Một nguồn AI: nghe ReviewRequested trên VoterHub, đọc đề xuất (mô tả và hành động thực thi),
// chấm cho từng Voter theo chính sách riêng bằng Gemini, rồi gửi submitVerdict qua Hub.
// Chạy nhiều tiến trình với ví và model khác nhau để có nhiều nguồn; Hub chỉ chốt khi đủ ngưỡng đồng ý.
//   AI_KEY_VAR   tên biến chứa private key của nguồn này (mặc định AI_SERVICE_PRIVATE_KEY)
//   AGENT_MODEL  model Gemini của nguồn này (mặc định GEMINI_MODEL)
import http from "node:http";
import { ethers } from "ethers";
import { judge } from "./judge.js";
import { describeActions } from "./actions.js";
import { createDrip } from "./drip.js";

const env = (k, d) => process.env[k] || d;
const need = (k) => {
  const v = process.env[k];
  if (!v) throw new Error(`Thiếu biến môi trường ${k}`);
  return v;
};

const provider = new ethers.JsonRpcProvider(env("BASE_SEPOLIA_RPC", "https://sepolia.base.org"));
const wallet = new ethers.Wallet(need(env("AI_KEY_VAR", "AI_SERVICE_PRIVATE_KEY")), provider);
// Ví này vừa gửi phán quyết vừa cấp gas (nguồn 1), nên dùng NonceManager để hai việc không tranh nonce.
const signer = new ethers.NonceManager(wallet);
const apiKey = need("LLM_API_KEY");
const model = env("AGENT_MODEL", env("GEMINI_MODEL", "gemini-3.1-flash-lite"));
// Model dự phòng khi model chính quá tải lâu (503, 429). Mặc định dùng bản flash-lite mới nhất của Google.
const fallbackModel = env("FALLBACK_MODEL", "gemini-flash-lite-latest");
const RETRY_ROUNDS = Number(env("RETRY_ROUNDS", "3"));
const MAX_VOTERS = Number(env("MAX_VOTERS_PER_PROPOSAL", "50"));

const hub = new ethers.Contract(
  need("HUB_ADDRESS"),
  [
    "event ReviewRequested(address indexed governor, uint256 indexed proposalId)",
    "function voterCount() view returns (uint256)",
    "function voters(uint256) view returns (address)",
    "function agentVerdictOf(address voter, uint256 proposalId, address agent) view returns (uint8)",
    "function finalized(bytes32) view returns (bool)",
    "function submitVerdict(address voter, uint256 proposalId, uint8 verdict, uint8 confidence, string reason)",
  ],
  signer,
);
const voterAbi = [
  "function governor() view returns (address)",
  "function policy() view returns (string)",
];
const governorAbi = [
  "event ProposalCreated(uint256 proposalId, address proposer, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, uint256 voteStart, uint256 voteEnd, string description)",
  "function state(uint256) view returns (uint8)",
  "function proposalSnapshot(uint256) view returns (uint256)",
  "function getVotes(address account, uint256 timepoint) view returns (uint256)",
];

const VERDICT_ENUM = { for: 1, against: 2, skip: 3 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString(), `[${model}]`, ...a);
const short = (id) => `#${String(id).slice(-6)}`;
const keyOf = (voter, pid) => ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [voter, pid]));

async function findProposal(governor, proposalId, eventBlock) {
  // RPC công khai giới hạn eth_getLogs 200 block; ReviewRequested đến sau ProposalCreated vài block.
  const logs = await governor.queryFilter(governor.filters.ProposalCreated(), eventBlock - 150, eventBlock);
  const hit = logs.find((l) => l.args.proposalId === proposalId);
  if (!hit) return null;
  return { description: hit.args.description, targets: [...hit.args.targets], values: [...hit.args[3]], calldatas: [...hit.args.calldatas] };
}

async function waitUntilActive(governor, proposalId) {
  for (;;) {
    const s = Number(await governor.state(proposalId)); // 0 Pending, 1 Active
    if (s === 1) return true;
    if (s > 1) return false;
    await sleep(3000);
  }
}

async function handle(governorAddr, proposalId, eventBlock) {
  const governor = new ethers.Contract(governorAddr, governorAbi, provider);
  const proposal = await findProposal(governor, proposalId, eventBlock);
  if (!proposal) return log(`${short(proposalId)} không tìm thấy đề xuất, bỏ qua`);
  const actions = await describeActions(proposal.targets, proposal.values, proposal.calldatas);
  log(`${short(proposalId)} hành động:\n${actions}`);

  // Phiếu được tính tại thời điểm chụp: Voter không có quyền biểu quyết lúc đó thì không cần chấm (chống spam).
  if (!(await waitUntilActive(governor, proposalId))) return log(`${short(proposalId)} hết hạn bỏ phiếu`);
  const snapshot = await governor.proposalSnapshot(proposalId);

  const count = Math.min(Number(await hub.voterCount()), MAX_VOTERS);
  const jobs = [];
  for (let i = 0; i < count; i++) {
    const voterAddr = await hub.voters(i);
    const voter = new ethers.Contract(voterAddr, voterAbi, provider);
    if ((await voter.governor()).toLowerCase() !== governorAddr.toLowerCase()) continue;
    if ((await governor.getVotes(voterAddr, snapshot)) === 0n) continue; // không có phiếu
    if (Number(await hub.agentVerdictOf(voterAddr, proposalId, wallet.address)) !== 0) continue; // đã gửi
    if (await hub.finalized(keyOf(voterAddr, proposalId))) continue; // đã chốt
    const policy = await voter.policy();
    if (!policy.trim()) continue; // chưa có chính sách
    jobs.push({ voterAddr, policy });
  }
  if (jobs.length === 0) return log(`${short(proposalId)} không có Voter nào cần chấm`);

  // Voter nào chấm hoặc gửi lỗi thì thử lại ở lượt sau, khi đề xuất vẫn đang mở bỏ phiếu.
  let pending = jobs;
  for (let round = 0; round <= RETRY_ROUNDS && pending.length > 0; round++) {
    if (round > 0) {
      await sleep(20_000);
      if (Number(await governor.state(proposalId)) !== 1) {
        log(`${short(proposalId)} hết hạn bỏ phiếu, bỏ ${pending.length} Voter chưa chấm được`);
        return;
      }
      log(`${short(proposalId)} thử lại lượt ${round} cho ${pending.length} Voter`);
    }
    const failed = [];
    for (const job of pending) {
      const { voterAddr, policy } = job;
      try {
        if (await hub.finalized(keyOf(voterAddr, proposalId))) continue;
        if (Number(await hub.agentVerdictOf(voterAddr, proposalId, wallet.address)) !== 0) continue;
        const r = await judge({ apiKey, model, fallbackModel, policy, description: proposal.description, actions });
        const via = r.fallbackFrom ? ` [dự phòng ${r.model}, vì ${r.primaryError}]` : "";
        log(`${short(proposalId)} ${voterAddr.slice(0, 8)}: ${r.verdict} (${r.confidence}) ${r.reason}${via}`);
        const tx = await hub.submitVerdict(voterAddr, proposalId, VERDICT_ENUM[r.verdict], r.confidence, r.reason);
        log(`${short(proposalId)} ${voterAddr.slice(0, 8)} submitVerdict tx ${tx.hash}`);
        await tx.wait();
      } catch (err) {
        log(`${short(proposalId)} ${voterAddr.slice(0, 8)} lỗi: ${err.shortMessage || err.message}`);
        signer.reset();
        failed.push(job);
      }
    }
    pending = failed;
  }
}

// Xử lý lần lượt từng đề xuất để tránh trùng nonce của ví nguồn AI này.
let queue = Promise.resolve();
function enqueue(governor, proposalId, eventBlock) {
  queue = queue.then(() => handle(governor, proposalId, eventBlock)).catch((err) => log(`${short(proposalId)} lỗi: ${err.message}`));
}

// CP16: cảnh báo khi quỹ lREACT của contract Reactive sắp cạn (nạp bằng scripts/reactive-funds.mjs --fund).
const REACTIVE = process.env.REACTIVE_ADDRESS;
const lasna = new ethers.JsonRpcProvider(env("LASNA_RPC", "https://lasna-rpc.rnk.dev/"));
const lasnaSystem = new ethers.Contract(
  "0x8888888888888888888888888888888888888888",
  ["function debt(address) view returns (uint256)", "function reserves(address) view returns (uint256)"],
  lasna,
);
async function checkReactiveFunds() {
  if (!REACTIVE) return;
  try {
    const [bal, res, debt] = await Promise.all([lasna.getBalance(REACTIVE), lasnaSystem.reserves(REACTIVE), lasnaSystem.debt(REACTIVE)]);
    const left = (bal + res - debt) / ethers.parseEther(env("COST_PER_PROPOSAL", "0.1"));
    if (left < BigInt(env("MIN_PROPOSALS", "50"))) log(`CẢNH BÁO: quỹ Reactive chỉ đủ khoảng ${left} đề xuất, chạy scripts/reactive-funds.mjs --fund`);
  } catch (err) {
    log(`không kiểm tra được quỹ Reactive: ${err.shortMessage || err.message}`);
  }
}

// CP14: endpoint /health cho nền tảng cloud; /drip cấp gas cho ví mới. Chỉ mở khi có biến PORT (nguồn 1).
const status = { agent: wallet.address, model, startedAt: new Date().toISOString(), lastScanBlock: 0, lastScanAt: null, lastReview: null };
const ALLOWED_ORIGINS = env("ALLOWED_ORIGINS", "https://dao-autopilot.vercel.app,http://localhost:5173,http://localhost:4173").split(",");
const drip = createDrip({ signer, provider, log });

function send(res, code, body, origin) {
  const headers = { "content-type": "application/json" };
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers["access-control-allow-origin"] = origin;
    headers["vary"] = "origin";
  }
  res.writeHead(code, headers);
  res.end(JSON.stringify(body));
}

if (process.env.PORT) {
  http
    .createServer(async (req, res) => {
      const origin = req.headers.origin;
      const path = (req.url || "/").split("?")[0];
      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "access-control-allow-origin": ALLOWED_ORIGINS.includes(origin) ? origin : "",
          "access-control-allow-methods": "POST, GET, OPTIONS",
          "access-control-allow-headers": "content-type",
          "access-control-max-age": "86400",
        });
        return res.end();
      }
      if (path === "/drip" && req.method === "POST") {
        let raw = "";
        req.on("data", (c) => {
          raw += c;
          if (raw.length > 1000) req.destroy();
        });
        req.on("end", async () => {
          try {
            const { address } = JSON.parse(raw || "{}");
            const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").toString().split(",")[0].trim();
            const r = await drip(String(address || ""), ip);
            send(res, r.status, r.body, origin);
          } catch (err) {
            send(res, 400, { error: "Bad request." }, origin);
          }
        });
        return;
      }
      const stale = !status.lastScanAt || Date.now() - Date.parse(status.lastScanAt) > 60_000;
      send(res, stale ? 503 : 200, { ok: !stale, ...status }, origin);
    })
    .listen(Number(process.env.PORT), () => log(`health và drip trên cổng ${process.env.PORT}`));
}

async function main() {
  log(`nguồn AI chạy: ví ${wallet.address}, hub ${await hub.getAddress()}`);
  checkReactiveFunds();
  setInterval(checkReactiveFunds, 10 * 60 * 1000);
  let next = process.env.START_BLOCK ? Number(process.env.START_BLOCK) : (await provider.getBlockNumber()) + 1;
  const seen = new Set();
  for (;;) {
    try {
      const head = await provider.getBlockNumber();
      if (head >= next) {
        const to = Math.min(head, next + 149);
        const events = await hub.queryFilter(hub.filters.ReviewRequested(), next, to);
        next = to + 1;
        status.lastScanBlock = to;
        status.lastScanAt = new Date().toISOString();
        for (const e of events) {
          const k = `${e.args.governor}:${e.args.proposalId}`;
          if (seen.has(k)) continue;
          seen.add(k);
          status.lastReview = { proposalId: e.args.proposalId.toString(), governor: e.args.governor, block: e.blockNumber };
          log(`ReviewRequested ${short(e.args.proposalId)} governor ${e.args.governor.slice(0, 8)} (block ${e.blockNumber})`);
          enqueue(e.args.governor, e.args.proposalId, e.blockNumber);
        }
      }
    } catch (err) {
      log(`lỗi đọc chain: ${err.message}`);
    }
    await sleep(2000);
  }
}

main();
