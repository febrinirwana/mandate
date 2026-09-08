import { createHash } from "node:crypto";
import { loadEnvFile } from "node:process";

import { MandateChainService } from "@mandate/chain";
import { createCanonicalEvidenceRepository, createDatabase } from "@mandate/db";
import { createPublicClient, http, isAddress, type Address } from "viem";
import { sepolia } from "viem/chains";

import { parseWorkerConfiguration } from "./config.js";
import { ConfirmationWorker, startConfirmationWorker } from "./worker.js";

try {
  loadEnvFile("../../.env");
} catch {
  // Deployed environments inject variables directly.
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value || value === "replace_me" || value.includes("example.invalid")) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

function errorHash(error: unknown): string {
  const value = error instanceof Error ? `${error.name}:${error.message}` : String(error);
  return createHash("sha256").update(value).digest("hex");
}

const configuration = parseWorkerConfiguration(process.env);
const mandateAppValue = requiredEnvironment("SEPOLIA_MANDATE_APP");
if (!isAddress(mandateAppValue)) throw new Error("SEPOLIA_MANDATE_APP must be an address");
const mandateApp = mandateAppValue.toLowerCase() as Address;
const deploymentBlock = BigInt(process.env["SEPOLIA_MANDATE_DEPLOYMENT_BLOCK"] ?? "11648628");
const client = createPublicClient({
  chain: sepolia,
  transport: http(requiredEnvironment("SEPOLIA_RPC_URL")),
});
const chain = new MandateChainService([
  { chainId: sepolia.id.toString(), client, mandateApp, deploymentBlock },
]);
const database = createDatabase();
const repository = createCanonicalEvidenceRepository(database.db);
const worker = new ConfirmationWorker({
  chain,
  repository,
  confirmationDepth: configuration.confirmationDepth,
  batchSize: configuration.batchSize,
});
const loop = startConfirmationWorker(worker, {
  pollIntervalMs: configuration.pollIntervalMs,
  onResult: (result) => {
    console.log(JSON.stringify({ level: "info", event: "confirmation_batch", ...result }));
  },
  onError: (error) => {
    console.error(
      JSON.stringify({
        level: "error",
        event: "confirmation_batch_failed",
        errorHash: errorHash(error),
      }),
    );
  },
});

let shuttingDown = false;
async function shutdown(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  await loop.stop();
  await database.close();
}

function requestShutdown(): void {
  void shutdown().catch((error: unknown) => {
    console.error(
      JSON.stringify({
        level: "error",
        event: "worker_shutdown_failed",
        errorHash: errorHash(error),
      }),
    );
    process.exitCode = 1;
  });
}

process.once("SIGINT", requestShutdown);
process.once("SIGTERM", requestShutdown);
