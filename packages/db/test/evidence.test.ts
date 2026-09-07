import { describe, expect, it } from "vitest";

import { assertPersistableEvidence } from "../src/evidence.js";

const address = (digit: string) => `0x${digit.repeat(40)}`;
const hash = (digit: string) => `0x${digit.repeat(64)}`;

const validEvidence = {
  version: 1,
  strategy: {
    version: 1,
    maker: address("1"),
    agent: address("2"),
    ensRegistry: address("3"),
    ensResolver: address("4"),
    ensLabel: "operator",
    ensNode: hash("5"),
    tokenIn: address("6"),
    tokenOut: address("7"),
    swapTarget: address("8"),
    swapSelector: "0x12345678",
    minRateNumerator: "1",
    minRateDenominator: "2",
    maxInputPerCall: "10",
    maxInputTotal: "20",
    validAfter: "1",
    validUntil: "2",
    salt: hash("9"),
  },
  execution: {
    version: 1,
    chainId: "31337",
    txHash: hash("a"),
    block: { number: "2", hash: hash("b") },
    strategyHash: hash("c"),
    caller: address("2"),
    amountIn: "10",
    amountOut: "20",
    usedInputAfter: "10",
    status: "CONFIRMED",
  },
  audit: {
    version: 1,
    result: "COMPLIANT",
    chainId: "31337",
    txHash: hash("a"),
    block: { number: "2", hash: hash("b") },
    strategyHash: hash("c"),
    checks: [],
    evidence: [{ provider: "rpc-receipt", responseHash: hash("d") }],
  },
  events: [
    {
      logIndex: "0",
      contract: address("8"),
      topic0: hash("e"),
      topics: [hash("e")],
      data: "0x",
      kind: "MandateExecuted",
      decoded: { strategyHash: hash("c") },
      decoderVersion: 1,
    },
  ],
  balanceDeltas: [
    {
      account: address("1"),
      token: address("6"),
      beforeBlock: { number: "1", hash: hash("f") },
      afterBlock: { number: "2", hash: hash("b") },
      before: "10",
      after: "0",
      delta: "-10",
      source: "RPC_CALL",
    },
  ],
};

describe("assertPersistableEvidence", () => {
  it("returns a canonical, schema-validated public evidence value", () => {
    expect(assertPersistableEvidence(validEvidence)).toEqual(validEvidence);
  });

  it("rejects secret-shaped field names and credential-bearing URLs before persistence", () => {
    expect(() =>
      assertPersistableEvidence({ ...validEvidence, rawSignedTransaction: "0xdeadbeef" }),
    ).toThrow("sensitive evidence field");
    expect(() =>
      assertPersistableEvidence({
        ...validEvidence,
        events: [
          {
            ...validEvidence.events[0],
            decoded: { endpoint: "https://user:password@rpc.example.invalid" },
          },
        ],
      }),
    ).toThrow("credential-bearing URL");
  });

  it("rejects malformed chain values rather than persisting unchecked JSON", () => {
    expect(() =>
      assertPersistableEvidence({
        ...validEvidence,
        execution: { ...validEvidence.execution, amountIn: "01" },
      }),
    ).toThrow();
  });
});
