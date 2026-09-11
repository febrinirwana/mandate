import {
  AddressSchema,
  Hash32Schema,
  parsePolicyProfileJson,
  PositiveUint256StringSchema,
  type PolicyProfileV1,
  SelectorSchema,
} from "@mandate/domain";
import { parseUnits } from "viem";

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

export interface DemoAgentConfiguration {
  port: number;
  runtime: {
    chainId: number;
    rpcUrl: string;
    mandateApp: `0x${string}`;
    deploymentBlock: bigint;
    routeRecipient: `0x${string}`;
    allowedStrategyHash: `0x${string}`;
  };
  profile: PolicyProfileV1;
  maximumDemoInput: string;
  keystore: {
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

export function parseDemoAgentConfiguration(environment: Environment): DemoAgentConfiguration {
  if (environment["MANDATE_DEMO_AGENT_ENABLED"] !== "true") {
    throw new Error("MANDATE_DEMO_AGENT_ENABLED must be true");
  }
  const chainId = Number(environment["MANDATE_CHAIN_ID"] ?? "11155111");
  if (!Number.isSafeInteger(chainId) || chainId < 1) {
    throw new Error("MANDATE_CHAIN_ID is invalid");
  }
  const port = Number(environment["AGENT_PORT"] ?? "3002");
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new Error("AGENT_PORT is invalid");
  }
  const profile = parsePolicyProfileJson(required(environment, "MANDATE_POLICY_PROFILE"));
  if (!profile) throw new Error("MANDATE_POLICY_PROFILE is invalid");
  const rpcUrl = required(environment, "SEPOLIA_RPC_URL");
  if (!URL.canParse(rpcUrl)) throw new Error("SEPOLIA_RPC_URL is invalid");
  const deploymentBlock = BigInt(
    parsed(environment, "SEPOLIA_MANDATE_DEPLOYMENT_BLOCK", PositiveUint256StringSchema),
  );

  const mandateApp = parsed(environment, "SEPOLIA_MANDATE_APP", AddressSchema);
  let maximumDemoInput: string;
  try {
    maximumDemoInput = parseUnits(
      required(environment, "MANDATE_SEPOLIA_FAUCET_AMOUNT"),
      profile.tokenIn.decimals,
    ).toString();
  } catch {
    throw new Error("MANDATE_SEPOLIA_FAUCET_AMOUNT is invalid");
  }
  if (maximumDemoInput === "0") throw new Error("MANDATE_SEPOLIA_FAUCET_AMOUNT is invalid");

  return {
    port,
    runtime: {
      chainId,
      rpcUrl,
      mandateApp,
      deploymentBlock,
      routeRecipient: mandateApp,
      allowedStrategyHash: parsed(environment, "AGENT_STRATEGY_HASH", Hash32Schema),
    },
    profile,
    maximumDemoInput,
    keystore: {
      path: required(environment, "AGENT_KEYSTORE_PATH"),
      password: required(environment, "AGENT_KEYSTORE_PASSWORD"),
    },
  };
}
