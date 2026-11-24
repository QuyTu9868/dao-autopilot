// Kiểm tra quỹ lREACT của contract Reactive và nạp khi thấp.
// Dùng: node --env-file=.env scripts/reactive-funds.mjs          chỉ kiểm tra
//       node --env-file=.env scripts/reactive-funds.mjs --fund   nạp nếu dưới ngưỡng
// Mạng trừ phí từ số dư của contract và từ reserves (nạp qua depositTo của System contract).
// depositTo trả nợ trước rồi cộng phần còn lại vào reserves, nên luôn nạp qua depositTo.
import { ethers } from "../ai-service/node_modules/ethers/lib.esm/index.js";

const SYSTEM = "0x8888888888888888888888888888888888888888";
const REACTIVE = process.env.REACTIVE_ADDRESS || "0x0b2D1490Ea0E9A566eCcd61e8BaeAb81559c0f60";
const COST = ethers.parseEther(process.env.COST_PER_PROPOSAL || "0.1"); // đo thực tế khoảng 0.07 cho 1 đến 2 Voter
const MIN_PROPOSALS = BigInt(process.env.MIN_PROPOSALS || "50");
const TOPUP_TO_PROPOSALS = BigInt(process.env.TOPUP_TO_PROPOSALS || "60");

const provider = new ethers.JsonRpcProvider(process.env.LASNA_RPC || "https://lasna-rpc.rnk.dev/");
const system = new ethers.Contract(SYSTEM, ["function debt(address) view returns (uint256)", "function reserves(address) view returns (uint256)", "function depositTo(address) payable"], provider);

export async function fundsOf(address) {
  const [balance, reserves, debt] = await Promise.all([provider.getBalance(address), system.reserves(address), system.debt(address)]);
  const available = balance + reserves - debt;
  return { balance, reserves, debt, available, proposalsLeft: available > 0n ? available / COST : 0n };
}

const fmt = (v) => `${ethers.formatEther(v)} lREACT`;
const f = await fundsOf(REACTIVE);
console.log(`Reactive ${REACTIVE}`);
console.log(`  balance ${fmt(f.balance)}, reserves ${fmt(f.reserves)}, debt ${fmt(f.debt)}`);
console.log(`  enough for about ${f.proposalsLeft} proposals at ${fmt(COST)} each (need ${MIN_PROPOSALS})`);

if (f.proposalsLeft >= MIN_PROPOSALS) {
  console.log("  OK");
} else if (!process.argv.includes("--fund")) {
  console.log("  LOW: run again with --fund to top up");
  process.exitCode = 2;
} else {
  let pk = process.env.DEV_PRIVATE_KEY;
  if (!pk.startsWith("0x")) pk = "0x" + pk;
  const wallet = new ethers.Wallet(pk, provider);
  const amount = TOPUP_TO_PROPOSALS * COST - (f.available > 0n ? f.available : 0n) + f.debt;
  console.log(`  topping up ${fmt(amount)} via depositTo from ${wallet.address}`);
  // Lasna đòi phí ưu tiên tối thiểu 1 wei, còn ethers ước lượng ra 0, nên tự tính phí theo base fee của block mới nhất.
  const base = (await provider.getBlock("latest")).baseFeePerGas ?? 0n;
  const tip = ethers.parseUnits("1", "gwei");
  const tx = await system.connect(wallet).depositTo(REACTIVE, { value: amount, maxFeePerGas: base * 2n + tip, maxPriorityFeePerGas: tip });
  await tx.wait();
  const g = await fundsOf(REACTIVE);
  console.log(`  done ${tx.hash}: now enough for about ${g.proposalsLeft} proposals`);
}
