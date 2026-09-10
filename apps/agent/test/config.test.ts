import { expect, it } from "vitest";

import { parseAgentConfiguration } from "../src/config.js";
import { policy } from "./fixtures.js";

const base = {
  AGENT_KEYSTORE_PATH: "C:/ignored/agent.keystore",
  AGENT_KEYSTORE_PASSWORD: "test-secret-that-must-not-appear",
  SEPOLIA_RPC_URL: "https://rpc.example.test",
  SEPOLIA_MANDATE_APP: policy.mandateApp,
  SEPOLIA_AGENT_ADDRESS: policy.signer,
  AGENT_STRATEGY_HASH: policy.strategyHash,
  AGENT_TOKEN_IN: policy.tokenIn,
  AGENT_TOKEN_OUT: policy.tokenOut,
  AGENT_ROUTE_TARGET: policy.routeTarget,
  AGENT_ROUTE_SELECTOR: policy.routeSelector,
  AGENT_ROUTE_RECIPIENT: policy.routeRecipient,
  AGENT_MAX_INPUT_PER_CALL: policy.maxInputPerCall,
  AGENT_MAX_INPUT_TOTAL: policy.maxInputTotal,
};

it("parses the isolated Sepolia signer policy", () => {
  const configuration = parseAgentConfiguration(base);

  expect(configuration.runtime).toEqual({
    chainId: 11155111,
    rpcUrl: base.SEPOLIA_RPC_URL,
    mandateApp: policy.mandateApp,
  });
  expect(configuration.policy).toEqual(policy);
  expect(configuration.keystore?.path).toBe(base.AGENT_KEYSTORE_PATH);
});

it("selects explicit local runtime instead of stale Sepolia values", () => {
  const localApp = `0x${"f".repeat(40)}` as const;
  const configuration = parseAgentConfiguration({
    ...base,
    MANDATE_LOCAL_RPC_URL: "http://127.0.0.1:8545",
    MANDATE_LOCAL_CHAIN_ID: "31337",
    MANDATE_LOCAL_APP: localApp,
  });

  expect(configuration.runtime).toEqual({
    chainId: 31337,
    rpcUrl: "http://127.0.0.1:8545",
    mandateApp: localApp,
  });
  expect(configuration.policy.mandateApp).toBe(localApp);
  expect(configuration.policy.chainId).toBe("31337");
});

it("supports manual custody without server keystore credentials", () => {
  const configuration = parseAgentConfiguration({
    ...base,
    AGENT_CUSTODY_MODE: "manual",
    AGENT_KEYSTORE_PATH: undefined,
    AGENT_KEYSTORE_PASSWORD: undefined,
  });

  expect(configuration.custodyMode).toBe("manual");
  expect(configuration.keystore).toBeUndefined();
});

it("reports only missing variable names and never secret values", () => {
  expect(() => parseAgentConfiguration({ ...base, AGENT_STRATEGY_HASH: undefined })).toThrow(
    "AGENT_STRATEGY_HASH is not configured",
  );
  try {
    parseAgentConfiguration({ ...base, AGENT_ROUTE_SELECTOR: "secret-selector-value" });
  } catch (error) {
    expect(String(error)).not.toContain("secret-selector-value");
    expect(String(error)).not.toContain(base.AGENT_KEYSTORE_PASSWORD);
  }
});
