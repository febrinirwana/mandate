import { describe, expect, it } from "vitest";

import type { RouteAssessmentRequestV1 } from "@mandate/domain";

import { assessClassicSwapRoute } from "../src/index.js";

const address = (digit: string) => `0x${digit.repeat(40)}` as const;
const router = "0x111111125421ca6dc452d289314280a0f8842a65" as const;
const app = "0x2222222222222222222222222222222222222222" as const;
const weth = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2" as const;
const usdc = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" as const;
const amountIn = "100000000000000000";
const calldata =
  "0x07ed2379000000000000000000000000111116053f09d34a7eae8102887004445176ca11000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48000000000000000000000000111116053f09d34a7eae8102887004445176ca110000000000000000000000002222222222222222222222222222222222222222000000000000000000000000000000000000000000000000016345785d8a0000000000000000000000000000000000000000000000000000000000000e4e1c000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000012000000000000000000000000000000000000000000000000000000000000000021234000000000000000000000000000000000000000000000000000000000000" as const;

const strategy = {
  version: 1 as const,
  maker: address("1"),
  agent: address("3"),
  ensRegistry: address("4"),
  ensResolver: address("5"),
  ensLabel: "agent",
  ensNode: `0x${"6".repeat(64)}` as const,
  tokenIn: weth,
  tokenOut: usdc,
  swapTarget: router,
  swapSelector: "0x07ed2379" as const,
  minRateNumerator: "240000000",
  minRateDenominator: amountIn,
  maxInputPerCall: amountIn,
  maxInputTotal: "1000000000000000000",
  validAfter: "1789000000",
  validUntil: "1789005600",
  salt: `0x${"7".repeat(64)}` as const,
};

const providerResponse = {
  dstAmount: "250000000",
  tx: {
    from: app,
    to: router,
    data: calldata,
    value: "0",
    gas: 220000,
    gasPrice: "1000000000",
  },
};

const request = {
  version: 1 as const,
  chainId: "1" as const,
  mandateApp: app,
  strategy,
  amountIn,
  agentMinOut: "240000000",
  executionDeadline: "1789002300",
  protocols: ["UNISWAP_V3"],
  provider: {
    status: "AVAILABLE" as const,
    requestId: "request-123",
    requestedAt: "2026-09-10T01:00:00.000Z",
    response: providerResponse,
  },
};

function replaceCalldataWord(index: number, word: string): string {
  const normalized = word.replace(/^0x/, "").padStart(64, "0");
  const start = 10 + index * 64;
  return `${calldata.slice(0, start)}${normalized}${calldata.slice(start + 64)}`;
}

const assess = (input: RouteAssessmentRequestV1) =>
  assessClassicSwapRoute(input, new Date("2026-09-10T01:00:01.000Z"));

describe("assessClassicSwapRoute", () => {
  it("passes only an exact decoded 1inch route that satisfies the Mandate policy", () => {
    const assessment = assess(request);

    expect(assessment.result).toBe("PASS");
    expect(assessment.reasons).toEqual([]);
    expect(assessment.route).toMatchObject({
      requestId: "request-123",
      target: router,
      caller: app,
      recipient: app,
      tokenIn: weth,
      tokenOut: usdc,
      amountIn,
      routeMinimumOut: "240000000",
    });
    expect(assessment.checks.every(({ result }) => result === "PASS")).toBe(true);
    expect(assessment.evidence.map(({ provider }) => provider)).toEqual([
      "1inch-classic-swap-v6.1",
      "mandate-strategy",
    ]);
  });

  it.each([
    ["TARGET_MISMATCH", { ...providerResponse, tx: { ...providerResponse.tx, to: address("8") } }],
    [
      "CALLER_MISMATCH",
      { ...providerResponse, tx: { ...providerResponse.tx, from: address("8") } },
    ],
    [
      "RECIPIENT_MISMATCH",
      {
        ...providerResponse,
        tx: { ...providerResponse.tx, data: replaceCalldataWord(4, address("8")) },
      },
    ],
    [
      "AMOUNT_MISMATCH",
      {
        ...providerResponse,
        tx: { ...providerResponse.tx, data: replaceCalldataWord(5, "1") },
      },
    ],
  ] as const)("fails closed on %s provider disagreement", (reason, response) => {
    const assessment = assess({
      ...request,
      provider: { ...request.provider, response },
    });

    expect(assessment.result).toBe("FAIL");
    expect(assessment.reasons).toContain(reason);
  });

  it("fails when caps, rate floor, route minimum, or execution window disagree", () => {
    expect(
      assess({
        ...request,
        strategy: { ...strategy, maxInputPerCall: "99999999999999999" },
      }).reasons,
    ).toContain("PER_CALL_CAP_EXCEEDED");
    expect(assess({ ...request, agentMinOut: "239999999" }).reasons).toContain(
      "RATE_FLOOR_UNSATISFIED",
    );
    expect(
      assess({
        ...request,
        provider: {
          ...request.provider,
          response: {
            ...providerResponse,
            tx: {
              ...providerResponse.tx,
              data: replaceCalldataWord(6, `0x${BigInt(239_999_999).toString(16)}`),
            },
          },
        },
      }).reasons,
    ).toContain("ROUTE_MINIMUM_UNSATISFIED");
    expect(assess({ ...request, executionDeadline: "1789005601" }).reasons).toContain(
      "EXECUTION_DEADLINE_INVALID",
    );
  });

  it("returns UNKNOWN rather than manufacturing PASS for unavailable or malformed evidence", () => {
    const unavailable = assess({
      ...request,
      provider: {
        status: "UNAVAILABLE",
        observedAt: "2026-09-10T01:00:00.000Z",
        reason: "TIMEOUT",
      },
    });
    const malformed = assess({
      ...request,
      provider: { ...request.provider, response: { dstAmount: "250000000" } },
    });

    expect(unavailable).toMatchObject({
      result: "UNKNOWN",
      reasons: ["ONEINCH_UNAVAILABLE"],
      route: null,
    });
    expect(malformed).toMatchObject({
      result: "UNKNOWN",
      reasons: ["ONEINCH_RESPONSE_INVALID"],
      route: null,
    });
  });
});
