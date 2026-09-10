import {
  AddressSchema,
  Hash32Schema,
  PositiveUint256StringSchema,
  SelectorSchema,
} from "@mandate/domain";

import type { AgentPolicy } from "./policy.js";

export interface AgentConfiguration {
  runtime: {
    chainId: number;
    rpcUrl: string;
    mandateApp: `0x${string}`;
  };
  policy: AgentPolicy;
  custodyMode: "automated" | "manual";
  keystore?: {
    path: string;
    password: string;
  };
}

type Environment = Record<string, string | undefined>;

function required(environment: Environment, name: string): string {
  const value = environment[name];
  if (!value || value === "replace_me" || value.includes("example.invalid")) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

function parsed<T>(
  environment: Environment,
  name: string,
  schema: { safeParse(value: unknown): { success: boolean; data?: T } },
): T {
  const result = schema.safeParse(required(environment, name));
  if (!result.success) throw new Error(`${name} is invalid`);
  return result.data as T;
}

export function parseAgentConfiguration(environment: Environment): AgentConfiguration {
  const local = Boolean(environment["MANDATE_LOCAL_RPC_URL"]);
  const rpcName = local ? "MANDATE_LOCAL_RPC_URL" : "SEPOLIA_RPC_URL";
  const appName = local ? "MANDATE_LOCAL_APP" : "SEPOLIA_MANDATE_APP";
  const chainValue = local ? (environment["MANDATE_LOCAL_CHAIN_ID"] ?? "31337") : "11155111";
  const chainId = Number(chainValue);
  if (!Number.isSafeInteger(chainId) || chainId < 1) {
    throw new Error(`${local ? "MANDATE_LOCAL_CHAIN_ID" : "SEPOLIA_CHAIN_ID"} is invalid`);
  }
  const rpcUrl = required(environment, rpcName);
  if (!URL.canParse(rpcUrl)) throw new Error(`${rpcName} is invalid`);
  const mandateApp = parsed(environment, appName, AddressSchema);
  const signer = parsed(environment, "SEPOLIA_AGENT_ADDRESS", AddressSchema);
  const maxInputPerCall = parsed(
    environment,
    "AGENT_MAX_INPUT_PER_CALL",
    PositiveUint256StringSchema,
  );
  const maxInputTotal = parsed(environment, "AGENT_MAX_INPUT_TOTAL", PositiveUint256StringSchema);
  if (BigInt(maxInputPerCall) > BigInt(maxInputTotal)) {
    throw new Error("AGENT_MAX_INPUT_PER_CALL exceeds AGENT_MAX_INPUT_TOTAL");
  }
  const custodyMode = environment["AGENT_CUSTODY_MODE"] ?? "automated";
  if (custodyMode !== "automated" && custodyMode !== "manual") {
    throw new Error("AGENT_CUSTODY_MODE is invalid");
  }

  return {
    runtime: { chainId, rpcUrl, mandateApp },
    policy: {
      chainId: chainId.toString(),
      mandateApp,
      signer,
      strategyHash: parsed(environment, "AGENT_STRATEGY_HASH", Hash32Schema),
      tokenIn: parsed(environment, "AGENT_TOKEN_IN", AddressSchema),
      tokenOut: parsed(environment, "AGENT_TOKEN_OUT", AddressSchema),
      routeTarget: parsed(environment, "AGENT_ROUTE_TARGET", AddressSchema),
      routeSelector: parsed(environment, "AGENT_ROUTE_SELECTOR", SelectorSchema),
      routeRecipient: parsed(environment, "AGENT_ROUTE_RECIPIENT", AddressSchema),
      maxInputPerCall,
      maxInputTotal,
    },
    custodyMode,
    ...(custodyMode === "automated"
      ? {
          keystore: {
            path: required(environment, "AGENT_KEYSTORE_PATH"),
            password: required(environment, "AGENT_KEYSTORE_PASSWORD"),
          },
        }
      : {}),
  };
}
