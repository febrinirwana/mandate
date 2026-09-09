import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createPublicClient, encodeAbiParameters, http, keccak256 } from "viem";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const rpcUrl = process.env.MANDATE_LOCAL_RPC_URL ?? "http://127.0.0.1:8545";
const [deployment, artifact] = await Promise.all([
  readFile(`${root}/contracts/broadcast/local-deployment.json`, "utf8").then(JSON.parse),
  readFile(`${root}/contracts/out/MandateAquaApp.sol/MandateAquaApp.json`, "utf8").then(JSON.parse),
]);
const strategyHash = artifact.abi.find(
  (item) => item.type === "function" && item.name === "strategyHash",
);
const strategyParameter = strategyHash?.inputs?.[0];
if (!strategyParameter || strategyParameter.type !== "tuple") {
  throw new Error("Built artifact is missing strategyHash(Strategy)");
}

const strategy = {
  maker: "0x1111111111111111111111111111111111111111",
  agent: "0x2222222222222222222222222222222222222222",
  ensRegistry: "0x3333333333333333333333333333333333333333",
  ensResolver: "0x4444444444444444444444444444444444444444",
  ensLabel: "mandate-agent",
  ensNode: "0xc498c1b2d999c5e0ccd355baab1ba96394922f2aea9823167bea91fcbcda313f",
  tokenIn: "0x5555555555555555555555555555555555555555",
  tokenOut: "0x6666666666666666666666666666666666666666",
  swapTarget: "0x7777777777777777777777777777777777777777",
  swapSelector: "0xe3547335",
  minRateNumerator: 3n,
  minRateDenominator: 2n,
  maxInputPerCall: 100n,
  maxInputTotal: 1000n,
  validAfter: 1000n,
  validUntil: 2000n,
  salt: "0x8888888888888888888888888888888888888888888888888888888888888888",
};

const client = createPublicClient({ transport: http(rpcUrl) });
const [solidityHash, viemHash] = await Promise.all([
  client.readContract({
    address: deployment.app,
    abi: artifact.abi,
    functionName: "strategyHash",
    args: [strategy],
  }),
  Promise.resolve(keccak256(encodeAbiParameters([strategyParameter], [strategy]))),
]);
if (solidityHash !== viemHash) {
  throw new Error(`Strategy hash mismatch: Solidity=${solidityHash}, viem=${viemHash}`);
}
console.log(`Solidity and viem strategy hash: ${solidityHash}`);
