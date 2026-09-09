import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = resolve(repoRoot, "packages/contracts/src/deployments/mainnet.json");
const envPath = resolve(repoRoot, ".env");

if (existsSync(envPath)) {
  const local = parseEnv(readFileSync(envPath, "utf8"));
  const configured = process.env.SETTLEMENT_FORK_RPC_URL;
  if (!configured || configured.includes("example.invalid")) {
    process.env.SETTLEMENT_FORK_RPC_URL = local.SETTLEMENT_FORK_RPC_URL;
  }
}

const rpcUrl = process.env.SETTLEMENT_FORK_RPC_URL;
if (!rpcUrl || rpcUrl.includes("example.invalid")) {
  throw new Error("SETTLEMENT_FORK_RPC_URL is not configured");
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const blockNumber = manifest?.verificationBlock?.number;
if (manifest?.chainId !== "1" || !/^[1-9][0-9]*$/.test(blockNumber)) {
  throw new Error("mainnet venue manifest has no valid pinned Ethereum block");
}

const forge = process.env.FORGE_BIN || "forge";
const result = spawnSync(
  forge,
  [
    "test",
    "--match-contract",
    "MandateAquaAppForkTest",
    "--fork-url",
    rpcUrl,
    "--fork-block-number",
    blockNumber,
    "-vv",
  ],
  { cwd: resolve(repoRoot, "contracts"), stdio: "inherit" },
);

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
