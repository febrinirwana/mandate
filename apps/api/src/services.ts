import {
  ChainReadError,
  MandateChainService,
  StaleSimulationError,
  assessClassicSwapRoute,
} from "@mandate/chain";
import { createCanonicalEvidenceRepository, createDatabase, simulationEvidence } from "@mandate/db";
import { createPublicClient, http, isAddress, type Address, type Chain } from "viem";
import { sepolia } from "viem/chains";

import { ApiError, type ApiServices } from "./app.js";

type Environment = Record<string, string | undefined>;

export type RuntimeConfiguration = {
  local: boolean;
  chainId: string;
  rpcUrl: string;
  mandateApp: Address;
  deploymentBlock: string;
};

function requiredEnvironment(name: string, environment: Environment): string {
  const value = environment[name];
  if (!value || value === "replace_me" || value.includes("example.invalid")) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

export function runtimeConfiguration(environment: Environment = process.env): RuntimeConfiguration {
  const localRpc = environment["MANDATE_LOCAL_RPC_URL"];
  if (localRpc) {
    const mandateApp = requiredEnvironment("MANDATE_LOCAL_APP", environment).toLowerCase();
    if (!isAddress(mandateApp)) throw new Error("MANDATE_LOCAL_APP must be an address");
    return {
      local: true,
      chainId: environment["MANDATE_LOCAL_CHAIN_ID"] ?? "31337",
      rpcUrl: localRpc,
      mandateApp,
      deploymentBlock: environment["MANDATE_LOCAL_DEPLOYMENT_BLOCK"] ?? "0",
    };
  }

  const mandateApp = requiredEnvironment("SEPOLIA_MANDATE_APP", environment).toLowerCase();
  if (!isAddress(mandateApp)) throw new Error("SEPOLIA_MANDATE_APP must be an address");
  return {
    local: false,
    chainId: sepolia.id.toString(),
    rpcUrl: requiredEnvironment("SEPOLIA_RPC_URL", environment),
    mandateApp,
    deploymentBlock: requiredEnvironment("SEPOLIA_MANDATE_DEPLOYMENT_BLOCK", environment),
  };
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

function localChain(configuration: RuntimeConfiguration): Chain {
  const id = Number(configuration.chainId);
  if (!Number.isSafeInteger(id) || id < 1) throw new Error("MANDATE_LOCAL_CHAIN_ID must be safe");
  return {
    id,
    name: "Mandate local Anvil",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: {
      default: { http: [configuration.rpcUrl] },
      public: { http: [configuration.rpcUrl] },
    },
  };
}

export function createProductionServices(): { services: ApiServices; close: () => Promise<void> } {
  const configuration = runtimeConfiguration();
  const chainDefinition = configuration.local ? localChain(configuration) : sepolia;
  const client = createPublicClient({
    chain: chainDefinition,
    transport: http(configuration.rpcUrl),
  });
  const chain = new MandateChainService([
    {
      chainId: configuration.chainId,
      client,
      mandateApp: configuration.mandateApp,
      deploymentBlock: BigInt(configuration.deploymentBlock),
    },
  ]);
  const database = createDatabase();
  const evidence = createCanonicalEvidenceRepository(database.db);

  const services: ApiServices = {
    assessRoute: (input) => Promise.resolve(assessClassicSwapRoute(input, new Date())),
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
