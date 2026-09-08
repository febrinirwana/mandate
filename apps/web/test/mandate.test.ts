import { describe, expect, it } from "vitest";

import {
  buildExecutionIntent,
  inspectionStatus,
  isSimulationCurrent,
  remainingInput,
} from "../src/lib/mandate";

const address = (digit: string): `0x${string}` => `0x${digit.repeat(40)}`;
const hash = (digit: string): `0x${string}` => `0x${digit.repeat(64)}`;

const strategy = {
  version: 1 as const,
  maker: address("1"),
  agent: address("2"),
  ensRegistry: address("3"),
  ensResolver: address("4"),
  ensLabel: "operator",
  ensNode: hash("5"),
  tokenIn: address("6"),
  tokenOut: address("7"),
  swapTarget: address("8"),
  swapSelector: "0x12345678" as const,
  minRateNumerator: "1",
  minRateDenominator: "2",
  maxInputPerCall: "500",
  maxInputTotal: "1000",
  validAfter: "1",
  validUntil: "2000000000",
  salt: hash("9"),
};

const snapshot = {
  version: 1 as const,
  chainId: "31337",
  strategyHash: hash("a"),
  strategy,
  aqua: { address: address("c"), result: "PASS" as const, inputBalance: "500", outputBalance: "0" },
  physical: {
    result: "PASS" as const,
    makerTokenIn: "500",
    makerTokenOut: "0",
    agentTokenIn: "0",
    agentTokenOut: "0",
    appTokenIn: "0",
    appTokenOut: "0",
  },
  block: { number: "123", hash: hash("b") },
  state: { maker: strategy.maker, usedInput: "500", activated: true, revoked: false },
  ens: {
    status: "REGISTERED",
    tokenId: "1",
    owner: strategy.agent,
    expiry: "2000000000",
    address: strategy.agent,
  },
  result: "PASS" as const,
};

describe("inspection state", () => {
  it("reports the exact remaining cap and fails closed for unknown chain truth", () => {
    expect(remainingInput(snapshot)).toBe("500");
    expect(inspectionStatus(snapshot)).toBe("ACTIVE");
    expect(inspectionStatus({ ...snapshot, result: "UNKNOWN" as const })).toBe("UNKNOWN");
    expect(inspectionStatus({ ...snapshot, state: { ...snapshot.state, revoked: true } })).toBe(
      "REVOKED",
    );
  });

  it("invalidates a simulation when any bound execution input changes", () => {
    const intent = buildExecutionIntent({
      chainId: "31337",
      mandateApp: address("a"),
      strategy,
      amountIn: "100",
      agentMinOut: "50",
      executionDeadline: "1000",
      routeData: "0x12345678abcd",
    });
    const binding = {
      chainId: intent.request.chainId,
      blockNumber: "123",
      blockHash: hash("c"),
      caller: strategy.agent,
      to: intent.request.mandateApp,
      calldataHash: intent.calldataHash,
      strategyHash: intent.strategyHash,
      expiresAt: "2026-09-08T00:00:00.000Z",
    };

    expect(isSimulationCurrent(binding, intent.request)).toBe(true);
    expect(isSimulationCurrent(binding, { ...intent.request, amountIn: "101" })).toBe(false);
  });
});
