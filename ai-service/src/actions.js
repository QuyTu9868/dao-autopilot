// Giải mã phần thực thi của đề xuất (targets, values, calldatas) thành câu dễ đọc cho model.
// ABI lấy từ Blockscout (contract đã verify); không có thì tra tên hàm theo selector; vẫn không có thì để selector thô.
import { ethers } from "ethers";

const BLOCKSCOUT = process.env.BLOCKSCOUT_API || "https://base-sepolia.blockscout.com/api/v2";
const MAX_TEXT = 3000;
const abiCache = new Map();
const sigCache = new Map();

async function fetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) return null;
  return res.json();
}

async function contractInfo(address) {
  const key = address.toLowerCase();
  if (!abiCache.has(key)) {
    let info = null;
    try {
      const d = await fetchJson(`${BLOCKSCOUT}/smart-contracts/${address}`);
      if (d?.abi) info = { name: d.name, iface: new ethers.Interface(d.abi) };
    } catch {
      info = null;
    }
    abiCache.set(key, info);
  }
  return abiCache.get(key);
}

async function signatureOf(selector) {
  if (!sigCache.has(selector)) {
    let sig = null;
    try {
      const d = await fetchJson(`https://api.openchain.xyz/signature-database/v1/lookup?function=${selector}`);
      sig = d?.result?.function?.[selector]?.[0]?.name ?? null;
    } catch {
      sig = null;
    }
    sigCache.set(selector, sig);
  }
  return sigCache.get(selector);
}

function fmtValue(v) {
  if (typeof v === "bigint") {
    // Số lớn: thêm cách đọc theo 18 chữ số thập phân (đa số token).
    return v >= 10n ** 15n ? `${v} (= ${ethers.formatUnits(v, 18)} if 18 decimals)` : v.toString();
  }
  if (Array.isArray(v)) return `[${v.map(fmtValue).join(", ")}]`;
  return String(v);
}

// Hàm thuần, test được: ghép một hành động đã giải mã thành một dòng.
export function formatAction({ index, target, value, contractName, fn, args, raw }) {
  const where = `${contractName ? contractName + " " : ""}${target}`;
  const eth = value > 0n ? `, sends ${ethers.formatEther(value)} ETH` : "";
  if (!fn && !raw) {
    if (target === ethers.ZeroAddress && value === 0n) return `${index}. no on-chain action (signal proposal)`;
    return `${index}. plain transfer to ${where}${eth || ", sends 0 ETH"}`;
  }
  if (!fn) return `${index}. call to ${where} with undecoded data ${raw}${eth}`;
  const a = (args ?? []).map(([n, v]) => `${n}=${fmtValue(v)}`).join(", ");
  return `${index}. call ${where}: ${fn}(${a})${eth}`;
}

export async function describeActions(targets, values, calldatas) {
  const lines = [];
  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    const value = BigInt(values[i] ?? 0);
    const data = calldatas[i] ?? "0x";
    const base = { index: i + 1, target, value };
    if (!data || data === "0x") {
      lines.push(formatAction(base));
      continue;
    }
    const info = await contractInfo(target);
    let decoded = null;
    if (info) {
      try {
        const tx = info.iface.parseTransaction({ data, value });
        if (tx) decoded = { contractName: info.name, fn: tx.name, args: tx.fragment.inputs.map((inp, k) => [inp.name || `arg${k}`, tx.args[k]]) };
      } catch {
        decoded = null;
      }
    }
    if (!decoded) {
      const selector = data.slice(0, 10);
      const sig = await signatureOf(selector);
      if (sig) {
        try {
          const iface = new ethers.Interface([`function ${sig}`]);
          const tx = iface.parseTransaction({ data });
          decoded = { contractName: info?.name, fn: tx.name, args: tx.fragment.inputs.map((inp, k) => [inp.name || `arg${k}`, tx.args[k]]) };
        } catch {
          decoded = null;
        }
      }
    }
    lines.push(formatAction(decoded ? { ...base, ...decoded } : { ...base, raw: data.length > 74 ? data.slice(0, 74) + "..." : data }));
  }
  const text = lines.join("\n");
  return text.length > MAX_TEXT ? text.slice(0, MAX_TEXT) + "\n(truncated)" : text;
}
