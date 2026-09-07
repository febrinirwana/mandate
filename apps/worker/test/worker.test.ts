import { describe, expect, it, vi } from "vitest";

import { ConfirmationWorker } from "../src/worker.js";

const hash = (digit: string) => `0x${digit.repeat(64)}` as const;

describe("ConfirmationWorker", () => {
  it("defers evidence until configured confirmation depth is reached", async () => {
    const repository = {
      listPendingConfirmations: vi
        .fn()
        .mockResolvedValue([
          { chainId: "31337", txHash: hash("1"), blockNumber: "10", blockHash: hash("2") },
        ]),
      persistCanonicalEvidence: vi.fn(),
      invalidateReorgedEvidence: vi.fn(),
      updateConfirmations: vi.fn(),
    };
    const chain = {
      getBlockHash: vi.fn().mockResolvedValue(hash("2")),
      getBlockNumber: vi.fn().mockResolvedValue(11n),
      readCanonicalEvidence: vi.fn(),
    };
    const worker = new ConfirmationWorker({
      chain,
      repository,
      confirmationDepth: 2,
      batchSize: 10,
    });

    await expect(worker.runOnce()).resolves.toEqual({ deferred: 1, persisted: 0, reorged: 0 });
    expect(repository.persistCanonicalEvidence).not.toHaveBeenCalled();
    expect(repository.updateConfirmations).toHaveBeenCalledWith("31337", hash("1"), 1);
  });

  it("invalidates evidence when canonical ancestry replaces the recorded block hash", async () => {
    const repository = {
      listPendingConfirmations: vi
        .fn()
        .mockResolvedValue([
          { chainId: "31337", txHash: hash("1"), blockNumber: "10", blockHash: hash("2") },
        ]),
      persistCanonicalEvidence: vi.fn(),
      invalidateReorgedEvidence: vi.fn(),
      updateConfirmations: vi.fn(),
    };
    const chain = {
      getBlockHash: vi.fn().mockResolvedValue(hash("3")),
      getBlockNumber: vi.fn(),
      readCanonicalEvidence: vi.fn(),
    };
    const worker = new ConfirmationWorker({
      chain,
      repository,
      confirmationDepth: 2,
      batchSize: 10,
    });

    await expect(worker.runOnce()).resolves.toEqual({ deferred: 0, persisted: 0, reorged: 1 });
    expect(repository.invalidateReorgedEvidence).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "BLOCK_HASH_REPLACED" }),
    );
  });
});
