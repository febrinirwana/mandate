import { createCipheriv, randomUUID, scryptSync } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { MandateChainService } from "@mandate/chain";
import {
  createPublicClient,
  defineChain,
  encodeFunctionData,
  http,
  keccak256,
  parseAbi,
  parseAbiItem,
  toHex,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { z } from "zod";

import {
  AgentRejection,
  createDedicatedKeystoreSigner,
  prepareExecution,
  runAutomatedExecution,
} from "../src/index.js";

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
};
const PrivateKeySchema = z.string().regex(/^0x[0-9a-fA-F]{64}$/) as z.ZodType<Hex>;
const DeploymentSchema = z.strictObject({
  aqua: z.string(),
  app: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  registry: z.string(),
  resolver: z.string(),
  tokenIn: z.string(),
  tokenOut: z.string(),
  venue: z.string(),
});
const chain = defineChain({
  id: 31337,
  name: "Mandate local smoke",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } },
});
const rpcUrl = required("MANDATE_LOCAL_RPC_URL");
const client = createPublicClient({ chain, transport: http(rpcUrl) });
const deployment = DeploymentSchema.parse(
  JSON.parse(await readFile("../../contracts/broadcast/local-deployment.json", "utf8")),
);
const app = deployment.app.toLowerCase() as `0x${string}`;
const activated = await client.getLogs({
  address: app,
  event: parseAbiItem(
    "event MandateActivated(bytes32 indexed strategyHash,address indexed maker,address indexed agent,bytes strategy)",
  ),
  fromBlock: 0n,
});
const strategyHash = activated.at(-1)?.args.strategyHash;
if (!strategyHash) throw new Error("local activation event is unavailable");
const authority = new MandateChainService([
  { chainId: chain.id.toString(), client, mandateApp: app, deploymentBlock: 0n },
]);
const snapshot = await authority.readMandate({ chainId: chain.id.toString(), strategyHash });
const block = await client.getBlock();
const amountIn = "10000000000000000000";
const routeData = encodeFunctionData({
  abi: parseAbi(["function swap(uint256 amountIn,uint256 amountOut,address recipient)"]),
  functionName: "swap",
  args: [BigInt(amountIn), BigInt(amountIn), app],
});
const request = {
  chainId: chain.id.toString(),
  mandateApp: app,
  strategy: snapshot.strategy,
  amountIn,
  agentMinOut: amountIn,
  executionDeadline: (block.timestamp + 300n).toString(),
  routeData,
};
const simulation = await authority.simulate(request);
if (snapshot.result !== "PASS" || simulation.result !== "PASS") {
  throw new Error("local inspection or simulation did not pass");
}

const privateKey = PrivateKeySchema.parse(required("LOCAL_AGENT_PRIVATE_KEY"));
const account = privateKeyToAccount(privateKey);
const directory = await mkdtemp(join(tmpdir(), "mandate-agent-smoke-"));
const keystorePath = join(directory, "agent.keystore");
const password = randomUUID();
try {
  const salt = Buffer.from(randomUUID().replaceAll("-", "").repeat(2), "hex");
  const iv = Buffer.from(randomUUID().replaceAll("-", ""), "hex");
  const derived = scryptSync(password, salt, 32, { N: 1024, r: 8, p: 1, maxmem: 32 * 1024 * 1024 });
  const cipher = createCipheriv("aes-128-ctr", derived.subarray(0, 16), iv);
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(privateKey.slice(2), "hex")),
    cipher.final(),
  ]);
  const mac = keccak256(toHex(Buffer.concat([derived.subarray(16, 32), ciphertext]))).slice(2);
  derived.fill(0);
  await writeFile(
    keystorePath,
    JSON.stringify({
      version: 3,
      id: randomUUID(),
      address: account.address.slice(2).toLowerCase(),
      crypto: {
        cipher: "aes-128-ctr",
        cipherparams: { iv: iv.toString("hex") },
        ciphertext: ciphertext.toString("hex"),
        kdf: "scrypt",
        kdfparams: { dklen: 32, n: 1024, r: 8, p: 1, salt: salt.toString("hex") },
        mac,
      },
    }),
  );

  const policy = {
    chainId: chain.id.toString(),
    mandateApp: app,
    signer: account.address.toLowerCase() as `0x${string}`,
    strategyHash,
    tokenIn: snapshot.strategy.tokenIn,
    tokenOut: snapshot.strategy.tokenOut,
    routeTarget: snapshot.strategy.swapTarget,
    routeSelector: snapshot.strategy.swapSelector,
    routeRecipient: app,
    maxInputPerCall: snapshot.strategy.maxInputPerCall,
    maxInputTotal: snapshot.strategy.maxInputTotal,
  };
  const intent = {
    chainId: request.chainId,
    strategy: request.strategy,
    amountIn: request.amountIn,
    agentMinOut: request.agentMinOut,
    executionDeadline: request.executionDeadline,
    routeData: request.routeData,
    simulation,
  };
  const nonceBefore = await client.getTransactionCount({ address: account.address });
  let maliciousReason: string | undefined;
  try {
    await prepareExecution({ ...intent, chainId: "1" }, policy, authority);
  } catch (error) {
    if (error instanceof AgentRejection) maliciousReason = error.reason;
    else throw error;
  }
  const nonceAfter = await client.getTransactionCount({ address: account.address });
  if (maliciousReason !== "TARGET_MISMATCH" || nonceAfter !== nonceBefore) {
    throw new Error(
      `malicious rejection=${maliciousReason ?? "none"} nonceChanged=${String(nonceAfter !== nonceBefore)}`,
    );
  }

  const signer = await createDedicatedKeystoreSigner(
    {
      keystorePath,
      keystorePassword: password,
      expectedSigner: policy.signer,
      chainId: chain.id,
      rpcUrl,
    },
    { policy, authority },
  );
  const result = await runAutomatedExecution(intent, { policy, authority, signer });
  if (result.execution.status !== "CONFIRMED" || result.audit.result !== "COMPLIANT") {
    throw new Error("local execution evidence is incomplete");
  }
  console.log(
    JSON.stringify({
      inspect: snapshot.result,
      simulate: simulation.result,
      execution: result.execution.status,
      audit: result.audit.result,
      malicious: maliciousReason,
    }),
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
