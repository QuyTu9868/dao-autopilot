// Cấp một ít ETH Base Sepolia cho ví mới để người thử (giám khảo) không phải tự đi xin ở faucet.
// Chỉ ví mới tinh mới nhận: chưa có giao dịch nào và gần như không có ETH. Điều kiện kiểm tra trên chain,
// nên dù dịch vụ khởi động lại thì một ví đã dùng app cũng không nhận được lần hai.
import { ethers } from "ethers";

export const DRIP_AMOUNT = ethers.parseEther(process.env.DRIP_AMOUNT || "0.002");
const MAX_BALANCE = ethers.parseEther("0.0005"); // có ít hơn mức này mới được nhận
const PER_IP_PER_DAY = Number(process.env.DRIP_PER_IP || "3");
const PER_DAY = Number(process.env.DRIP_PER_DAY || "40");

const day = () => new Date().toISOString().slice(0, 10);
let counters = { day: day(), total: 0, byIp: new Map(), inFlight: new Set() };

function resetIfNewDay() {
  if (counters.day !== day()) counters = { day: day(), total: 0, byIp: new Map(), inFlight: new Set() };
}

// Hàm thuần, test được: quyết định có cấp hay không dựa trên trạng thái ví và hạn mức.
export function checkEligibility({ nonce, balance, ipCount, total }) {
  if (nonce > 0) return "This wallet has already made transactions. Free gas is only for brand new test wallets.";
  if (balance >= MAX_BALANCE) return "This wallet already has enough test ETH.";
  if (ipCount >= PER_IP_PER_DAY) return "Daily limit reached for your network. Use a public faucet instead.";
  if (total >= PER_DAY) return "Today's free gas budget is used up. Use a public faucet instead.";
  return null;
}

export function createDrip({ signer, provider, log }) {
  return async function drip(address, ip) {
    resetIfNewDay();
    if (!ethers.isAddress(address)) return { status: 400, body: { error: "Invalid address." } };
    const to = ethers.getAddress(address);
    if (counters.inFlight.has(to)) return { status: 429, body: { error: "A transfer to this wallet is already on its way." } };
    const [nonce, balance] = await Promise.all([provider.getTransactionCount(to), provider.getBalance(to)]);
    const why = checkEligibility({ nonce, balance, ipCount: counters.byIp.get(ip) ?? 0, total: counters.total });
    if (why) return { status: 403, body: { error: why } };
    counters.inFlight.add(to);
    try {
      const tx = await signer.sendTransaction({ to, value: DRIP_AMOUNT });
      counters.total++;
      counters.byIp.set(ip, (counters.byIp.get(ip) ?? 0) + 1);
      log(`drip ${ethers.formatEther(DRIP_AMOUNT)} ETH -> ${to} tx ${tx.hash}`);
      return { status: 200, body: { hash: tx.hash, amount: ethers.formatEther(DRIP_AMOUNT) } };
    } catch (err) {
      signer.reset?.();
      log(`drip lỗi: ${err.shortMessage || err.message}`);
      return { status: 500, body: { error: "Could not send test ETH right now. Try again in a minute or use a public faucet." } };
    } finally {
      counters.inFlight.delete(to);
    }
  };
}
