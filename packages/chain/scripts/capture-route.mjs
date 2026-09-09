import { existsSync, readFileSync } from "node:fs";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

import { VenueManifestV1Schema } from "@mandate/domain";
import {
  concatHex,
  createPublicClient,
  encodeAbiParameters,
  getAddress,
  getCreate2Address,
  http,
  keccak256,
} from "viem";

import { ONEINCH_AGGREGATION_ROUTER_V6, requestClassicSwapRoute } from "../src/route.ts";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "../../..");
const MANIFEST_PATH = resolve(REPO_ROOT, "packages/contracts/src/deployments/mainnet.json");
const ARTIFACT_PATH = resolve(REPO_ROOT, "contracts/out/MandateAquaApp.sol/MandateAquaApp.json");

const CHAIN_ID = 1;
const AQUA = "0x1111113CCf1426A8E30e2bfF5E005d929bF6a90a";
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const CREATE2_DEPLOYER = "0x4e59b44847b379578588920cA78FbF26c0B4956C";
const CREATE2_SALT = keccak256(new TextEncoder().encode("mandate-phase6-mainnet-v1"));
const MAX_MANDATE_DURATION = 30n * 24n * 60n * 60n;
const AMOUNT_IN = 100_000_000_000_000_000n;

const erc20MetadataAbi = [
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
];

function loadLocalEnvironment() {
  const envPath = resolve(REPO_ROOT, ".env");
  if (!existsSync(envPath)) return;
  const local = parseEnv(readFileSync(envPath, "utf8"));
  for (const name of ["SETTLEMENT_FORK_RPC_URL", "ONEINCH_API_KEY"]) {
    const current = process.env[name];
    if (!current || current === "replace_me" || current.includes("example.invalid")) {
      const replacement = local[name];
      if (replacement) process.env[name] = replacement;
    }
  }
}

function requiredEnvironment(name) {
  const value = process.env[name];
  if (!value || value === "replace_me" || value.includes("example.invalid")) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

function readCreationBytecode() {
  if (!existsSync(ARTIFACT_PATH)) {
    throw new Error("Mandate artifact is missing; run forge build before capturing a route");
  }
  const artifact = JSON.parse(readFileSync(ARTIFACT_PATH, "utf8"));
  const bytecode = artifact?.bytecode?.object;
  if (typeof bytecode !== "string" || !/^0x[0-9a-fA-F]+$/.test(bytecode)) {
    throw new Error("Mandate artifact contains no deployable creation bytecode");
  }
  return bytecode;
}

function lower(value) {
  return value.toLowerCase();
}

async function runtimeProof(client, address, blockNumber) {
  const code = await client.getCode({ address, blockNumber });
  if (!code || code === "0x") throw new Error(`no runtime code at ${address}`);
  return { codeHash: keccak256(code), resultHash: keccak256(code) };
}

loadLocalEnvironment();
const rpcUrl = requiredEnvironment("SETTLEMENT_FORK_RPC_URL");
const client = createPublicClient({ transport: http(rpcUrl) });

if ((await client.getChainId()) !== CHAIN_ID) {
  throw new Error("SETTLEMENT_FORK_RPC_URL must target Ethereum mainnet chain 1");
}

const block = await client.getBlock({ blockTag: "finalized" });
if (block.number === null || block.hash === null)
  throw new Error("finalized block has no canonical identity");
const blockNumber = block.number;

const creationBytecode = readCreationBytecode();
const constructorArgs = encodeAbiParameters(
  [{ type: "address" }, { type: "uint64" }],
  [getAddress(AQUA), MAX_MANDATE_DURATION],
);
const initCode = concatHex([creationBytecode, constructorArgs]);
const app = getCreate2Address({
  from: getAddress(CREATE2_DEPLOYER),
  salt: CREATE2_SALT,
  bytecodeHash: keccak256(initCode),
});

const requestedAt = new Date().toISOString();
const captured = await requestClassicSwapRoute(
  {
    chainId: CHAIN_ID,
    srcToken: getAddress(WETH),
    dstToken: getAddress(USDC),
    amount: AMOUNT_IN,
    from: app,
    receiver: app,
    slippagePercent: "1",
    protocols: ["UNISWAP_V3"],
    complexityLevel: 0,
  },
  {
    chainId: CHAIN_ID,
    router: ONEINCH_AGGREGATION_ROUTER_V6,
    srcToken: getAddress(WETH),
    dstToken: getAddress(USDC),
    amount: AMOUNT_IN,
    caller: app,
    recipient: app,
    protocols: ["UNISWAP_V3"],
  },
  requiredEnvironment("ONEINCH_API_KEY"),
);
const route = captured.route;

const [
  routerProof,
  executorProof,
  aquaProof,
  wethProof,
  usdcProof,
  create2Proof,
  wethSymbol,
  wethDecimals,
  usdcSymbol,
  usdcDecimals,
] = await Promise.all([
  runtimeProof(client, getAddress(ONEINCH_AGGREGATION_ROUTER_V6), blockNumber),
  runtimeProof(client, route.executor, blockNumber),
  runtimeProof(client, getAddress(AQUA), blockNumber),
  runtimeProof(client, getAddress(WETH), blockNumber),
  runtimeProof(client, getAddress(USDC), blockNumber),
  runtimeProof(client, getAddress(CREATE2_DEPLOYER), blockNumber),
  client.readContract({
    address: getAddress(WETH),
    abi: erc20MetadataAbi,
    functionName: "symbol",
    blockNumber,
  }),
  client.readContract({
    address: getAddress(WETH),
    abi: erc20MetadataAbi,
    functionName: "decimals",
    blockNumber,
  }),
  client.readContract({
    address: getAddress(USDC),
    abi: erc20MetadataAbi,
    functionName: "symbol",
    blockNumber,
  }),
  client.readContract({
    address: getAddress(USDC),
    abi: erc20MetadataAbi,
    functionName: "decimals",
    blockNumber,
  }),
]);

if (wethSymbol !== "WETH" || wethDecimals !== 18 || usdcSymbol !== "USDC" || usdcDecimals !== 6) {
  throw new Error("token metadata differs from the admitted WETH/USDC pair");
}

const verificationBlock = { number: blockNumber.toString(), hash: lower(block.hash) };
const verifiedAt = new Date(Number(block.timestamp) * 1000).toISOString();
const manifest = VenueManifestV1Schema.parse({
  version: 1,
  environment: "ETHEREUM_MAINNET_FORK",
  chainId: "1",
  generatedAt: new Date().toISOString(),
  verificationBlock,
  contracts: [
    {
      kind: "AQUA",
      name: "1inch Aqua",
      enabled: true,
      external: true,
      official: true,
      chainId: "1",
      address: lower(AQUA),
      codeHash: lower(aquaProof.codeHash),
      sourceRevision: "81c26e4619ce21556ab02b3284ee2685de21fb18",
      sourceUrl:
        "https://business.1inch.com/portal/documentation/aqua/reference/contract-addresses",
      verificationBlock,
      verifiedAt,
      probes: [{ method: "eth_getCode", resultHash: lower(aquaProof.resultHash) }],
    },
    {
      kind: "SWAP_TARGET",
      name: "1inch Aggregation Router V6",
      enabled: true,
      external: true,
      official: true,
      chainId: "1",
      address: lower(ONEINCH_AGGREGATION_ROUTER_V6),
      codeHash: lower(routerProof.codeHash),
      sourceRevision: "etherscan-verified:AggregationRouterV6",
      sourceUrl: "https://etherscan.io/address/0x111111125421ca6dc452d289314280a0f8842a65#code",
      verificationBlock,
      verifiedAt,
      probes: [{ method: "eth_getCode", resultHash: lower(routerProof.resultHash) }],
    },
    {
      kind: "SWAP_EXECUTOR",
      name: "1inch Aggregation Executor",
      enabled: true,
      external: true,
      official: true,
      chainId: "1",
      address: lower(route.executor),
      codeHash: lower(executorProof.codeHash),
      sourceRevision: "etherscan-verified:AggregationExecutor",
      sourceUrl: `https://etherscan.io/address/${route.executor}#code`,
      verificationBlock,
      verifiedAt,
      probes: [{ method: "eth_getCode", resultHash: lower(executorProof.resultHash) }],
    },
  ],
  tokens: [
    {
      chainId: "1",
      address: lower(WETH),
      codeHash: lower(wethProof.codeHash),
      decimals: 18,
      symbol: "WETH",
    },
    {
      chainId: "1",
      address: lower(USDC),
      codeHash: lower(usdcProof.codeHash),
      decimals: 6,
      symbol: "USDC",
    },
  ],
  route: {
    ...route,
    responseHash: lower(captured.responseHash),
    apiVersion: "v6.1",
    endpoint: "https://api.1inch.com/swap/v6.1/1/swap",
    requestedAt,
    target: lower(route.target),
    caller: lower(route.caller),
    executor: lower(route.executor),
    recipient: lower(route.recipient),
    tokenIn: lower(route.tokenIn),
    tokenOut: lower(route.tokenOut),
    calldataHash: lower(route.calldataHash),
  },
});

await mkdir(dirname(MANIFEST_PATH), { recursive: true });
const temporaryPath = `${MANIFEST_PATH}.tmp`;
await writeFile(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
await rename(temporaryPath, MANIFEST_PATH);

console.log(
  JSON.stringify({
    blockNumber: verificationBlock.number,
    blockHash: verificationBlock.hash,
    app,
    router: route.target,
    executor: route.executor,
    selector: route.selector,
    requestId: route.requestId,
    create2DeployerCodeHash: create2Proof.codeHash,
    manifest: MANIFEST_PATH,
  }),
);
