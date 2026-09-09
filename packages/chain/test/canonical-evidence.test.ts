import type { ExecutionV1, ReceiptAuditV1, StrategyV1 } from "@mandate/domain";
import { BlockNotFoundError, type PublicClient } from "viem";
import { describe, expect, it, vi } from "vitest";

import {
  assembleCanonicalReceiptEvidence,
  ChainReadError,
  MandateChainService,
} from "../src/mandate.js";

const address = (digit: string) => `0x${digit.repeat(40)}` as const;
const hash = (digit: string) => `0x${digit.repeat(64)}` as const;
const strategy = {
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
} satisfies StrategyV1;
const execution = {
  version: 1,
  chainId: "31337",
  txHash: hash("a"),
  block: { number: "2", hash: hash("b") },
  transactionIndex: "0",
  strategyHash: hash("c"),
  caller: strategy.agent,
  amountIn: "10",
  amountOut: "20",
  usedInputAfter: "10",
  status: "CONFIRMED",
} satisfies ExecutionV1;
const audit = {
  version: 1,
  result: "COMPLIANT",
  chainId: execution.chainId,
  txHash: execution.txHash,
  block: execution.block,
  strategyHash: execution.strategyHash,
  checks: [],
  evidence: [{ provider: "rpc-receipt", responseHash: hash("d") }],
} satisfies ReceiptAuditV1;

describe("assembleCanonicalReceiptEvidence", () => {
  it("keeps a confirmed execution, audit, decoded event, and balance delta in one block-bound value", () => {
    const evidence = assembleCanonicalReceiptEvidence({
      strategy,
      execution,
      audit,
      events: [
        {
          logIndex: "0",
          contract: strategy.swapTarget,
          topic0: hash("e"),
          topics: [hash("e")],
          data: "0x",
          kind: "MandateExecuted",
          decoded: { strategyHash: execution.strategyHash },
          decoderVersion: 1,
        },
      ],
      balanceDeltas: [
        {
          account: strategy.maker,
          token: strategy.tokenIn,
          beforeBlock: { number: "1", hash: hash("f") },
          afterBlock: execution.block,
          before: "10",
          after: "0",
          delta: "-10",
          source: "RPC_CALL",
        },
      ],
    });

    expect(evidence.execution).toEqual(execution);
    expect(evidence.audit).toEqual(audit);
    expect(evidence.balanceDeltas[0]?.delta).toBe("-10");
  });

  it("refuses a reorged execution rather than returning durable canonical evidence", () => {
    expect(() =>
      assembleCanonicalReceiptEvidence({
        strategy,
        execution: { ...execution, status: "REORGED" },
        audit,
        events: [],
        balanceDeltas: [],
      }),
    ).toThrow("canonical evidence requires a confirmed execution");
  });
});

describe("MandateChainService.readCanonicalEvidence", () => {
  it("rejects an unsupported chain before attempting receipt persistence", async () => {
    const service = new MandateChainService([]);

    await expect(
      service.readCanonicalEvidence({ chainId: "31337", txHash: hash("a") }),
    ).rejects.toEqual(new ChainReadError("NOT_FOUND", "unsupported chain 31337"));
  });
});

describe("MandateChainService worker block reads", () => {
  it("returns canonical hashes and head numbers from the configured chain", async () => {
    const client = {
      getBlock: vi.fn().mockResolvedValue({ hash: hash("1") }),
      getBlockNumber: vi.fn().mockResolvedValue(12n),
    } as unknown as PublicClient;
    const service = new MandateChainService([
      { chainId: "31337", client, mandateApp: address("1") },
    ]);

    await expect(service.getBlockHash("31337", 10n)).resolves.toBe(hash("1"));
    await expect(service.getBlockNumber("31337")).resolves.toBe(12n);
  });

  it("distinguishes a missing canonical block from an unavailable RPC", async () => {
    const client = {
      getBlock: vi
        .fn()
        .mockRejectedValueOnce(new BlockNotFoundError({ blockNumber: 10n }))
        .mockRejectedValueOnce(new Error("transport failed")),
    } as unknown as PublicClient;
    const service = new MandateChainService([
      { chainId: "31337", client, mandateApp: address("1") },
    ]);

    await expect(service.getBlockHash("31337", 10n)).resolves.toBeNull();
    await expect(service.getBlockHash("31337", 10n)).rejects.toEqual(
      new ChainReadError("UNAVAILABLE", "canonical block read is unavailable"),
    );
  });
});
