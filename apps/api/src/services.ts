import { ChainReadError, MandateChainService, StaleSimulationError } from "@mandate/chain";
import { createCanonicalEvidenceRepository, createDatabase, simulationEvidence } from "@mandate/db";
import { createPublicClient, http, type Address } from "viem";
import { sepolia } from "viem/chains";

import { ApiError, type ApiServices } from "./app.js";

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value || value === "replace_me" || value.includes("example.invalid")) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

async function translate<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof StaleSimulationError) throw new ApiError(409, error.message);
    if (error instanceof ChainReadError) {
      throw new ApiError(error.kind === "NOT_FOUND" ? 404 : 503, error.message);
    }
    throw error;
  }
}

export function createProductionServices(): { services: ApiServices; close: () => Promise<void> } {
  const rpcUrl = requiredEnvironment("SEPOLIA_RPC_URL");
  const mandateApp = requiredEnvironment("SEPOLIA_MANDATE_APP").toLowerCase() as Address;
  const deploymentBlock = BigInt(process.env["SEPOLIA_MANDATE_DEPLOYMENT_BLOCK"] ?? "11648628");
  const client = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
  const chain = new MandateChainService([
    { chainId: sepolia.id.toString(), client, mandateApp, deploymentBlock },
  ]);
  const database = createDatabase();
  const evidence = createCanonicalEvidenceRepository(database.db);

  const services: ApiServices = {
    readMandate: (input) => translate(() => chain.readMandate(input)),
    readExecution: (input) =>
      translate(async () => {
        const execution = await chain.readExecution(input);
        if (execution.status === "CONFIRMED") {
          await evidence.trackObservedExecution(execution);
        }
        return execution;
      }),
    auditReceipt: (input) =>
      translate(async () => {
        const [execution, audit] = await Promise.all([
          chain.readExecution(input),
          chain.auditReceipt(input),
        ]);
        if (execution.status === "CONFIRMED") {
          await evidence.trackObservedExecution(execution);
        }
        return audit;
      }),
    simulate: (input) =>
      translate(async () => {
        const simulation = await chain.simulate(input);
        await database.db
          .insert(simulationEvidence)
          .values({
            id: simulation.id,
            chainId: simulation.binding.chainId,
            strategyHash: simulation.binding.strategyHash,
            blockNumber: simulation.binding.blockNumber,
            blockHash: simulation.binding.blockHash,
            caller: simulation.binding.caller,
            calldataHash: simulation.binding.calldataHash,
            result: simulation.result,
            response: simulation,
            expiresAt: new Date(simulation.binding.expiresAt),
          })
          .onConflictDoNothing({ target: simulationEvidence.id });
        return simulation;
      }),
  };

  return { services, close: database.close };
}
