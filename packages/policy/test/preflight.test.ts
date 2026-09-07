import { describe, expect, it } from "vitest";

import { evaluatePreflight, minimumOutput } from "../src/index.js";

const address = (digit: string) => `0x${digit.repeat(40)}` as const;
const hash = (digit: string) => `0x${digit.repeat(64)}` as const;

const input = {
  strategy: {
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
    minRateNumerator: "2",
    minRateDenominator: "3",
    maxInputPerCall: "100",
    maxInputTotal: "500",
    validAfter: "1000",
    validUntil: "2000",
    salt: hash("9"),
  },
  mandate: {
    maker: address("1"),
    usedInput: "25",
    activated: true,
    revoked: false,
  },
  ens: {
    available: true as const,
    status: "REGISTERED",
    owner: address("2"),
    resolver: address("4"),
    address: address("2"),
    expiry: "2100",
  },
  aqua: { available: true as const, active: true, inputBalance: "200" },
  request: {
    caller: address("2"),
    amountIn: "100",
    agentMinOut: "65",
    executionDeadline: "1600",
    routeData: "0x12345678abcd" as const,
  },
  blockTimestamp: "1500",
} as const;

describe("minimumOutput", () => {
  it("matches Solidity Math.mulDiv ceiling semantics", () => {
    expect(minimumOutput(100n, 2n, 3n)).toBe(67n);
    expect(minimumOutput(99n, 2n, 3n)).toBe(66n);
  });
});

describe("evaluatePreflight", () => {
  it("passes only when every deterministic contract precondition passes", () => {
    const evaluation = evaluatePreflight(input);

    expect(evaluation.result).toBe("PASS");
    expect(evaluation.reasons).toEqual([]);
    expect(evaluation.minimumOutput).toBe("67");
    expect(evaluation.checks.every((check) => check.result === "PASS")).toBe(true);
  });

  it.each([
    ["MANDATE_INACTIVE", { mandate: { ...input.mandate, activated: false } }],
    ["MANDATE_REVOKED", { mandate: { ...input.mandate, revoked: true } }],
    ["MANDATE_NOT_STARTED", { blockTimestamp: "999" }],
    ["MANDATE_EXPIRED", { blockTimestamp: "2000" }],
    ["CALLER_NOT_AGENT", { request: { ...input.request, caller: address("a") } }],
    ["ENS_NOT_REGISTERED", { ens: { ...input.ens, status: "AVAILABLE" } }],
    ["ENS_EXPIRED", { ens: { ...input.ens, expiry: "1500" } }],
    ["ENS_OWNER_MISMATCH", { ens: { ...input.ens, owner: address("a") } }],
    ["ENS_ADDRESS_MISMATCH", { ens: { ...input.ens, resolver: address("a") } }],
    ["INVALID_AMOUNT", { request: { ...input.request, amountIn: "0" } }],
    ["PER_CALL_CAP_EXCEEDED", { request: { ...input.request, amountIn: "101" } }],
    ["TOTAL_CAP_EXCEEDED", { mandate: { ...input.mandate, usedInput: "450" } }],
    ["SELECTOR_MISMATCH", { request: { ...input.request, routeData: "0x87654321" as const } }],
    ["EXECUTION_DEADLINE_EXPIRED", { request: { ...input.request, executionDeadline: "1499" } }],
    ["AQUA_STRATEGY_INACTIVE", { aqua: { ...input.aqua, active: false } }],
    ["AQUA_BALANCE_INSUFFICIENT", { aqua: { ...input.aqua, inputBalance: "99" } }],
  ])("returns FAIL for %s", (reason, patch) => {
    const evaluation = evaluatePreflight({ ...input, ...patch });

    expect(evaluation.result).toBe("FAIL");
    expect(evaluation.reasons).toContain(reason);
  });

  it("returns UNKNOWN when ENS or Aqua reads are unavailable", () => {
    const ens = evaluatePreflight({ ...input, ens: { available: false as const } });
    const aqua = evaluatePreflight({ ...input, aqua: { available: false as const } });

    expect(ens.result).toBe("UNKNOWN");
    expect(ens.reasons).toEqual(["ENS_READ_UNAVAILABLE"]);
    expect(aqua.result).toBe("UNKNOWN");
    expect(aqua.reasons).toEqual(["AQUA_READ_UNAVAILABLE"]);
  });
});
