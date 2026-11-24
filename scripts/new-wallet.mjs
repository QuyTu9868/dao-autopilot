// Tạo ví mới, ghi private key vào .env (không in key ra màn hình).
// Dùng: node scripts/new-wallet.mjs DEV_PRIVATE_KEY   hoặc   AI_SERVICE_PRIVATE_KEY
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";

const name = process.argv[2];
if (!["DEV_PRIVATE_KEY", "AI_SERVICE_PRIVATE_KEY", "AI2_SERVICE_PRIVATE_KEY"].includes(name)) {
  console.error("Dùng: node scripts/new-wallet.mjs DEV_PRIVATE_KEY|AI_SERVICE_PRIVATE_KEY|AI2_SERVICE_PRIVATE_KEY");
  process.exit(1);
}
if (!existsSync(".env")) copyFileSync(".env.example", ".env");

let env = readFileSync(".env", "utf8");
const re = new RegExp(`^${name}=(.*)$`, "m");
const m = env.match(re);
if (m && m[1].trim()) {
  console.error(`${name} đã có giá trị trong .env. Dừng để không ghi đè.`);
  process.exit(1);
}

const out = execFileSync("cast", ["wallet", "new", "--json"], { encoding: "utf8" });
const w = JSON.parse(out)[0];
env = m ? env.replace(re, `${name}=${w.private_key}`) : env + `\n${name}=${w.private_key}\n`;
writeFileSync(".env", env);
console.log(`Đã ghi ${name} vào .env. Địa chỉ ví: ${w.address}`);
