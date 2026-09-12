import { ChainReadError } from "@mandate/chain";
import { describe, expect, it, vi } from "vitest";

import { ConfirmationWorker } from "../src/worker.js";

const hash = (digit: string) => `0x${digit.repeat(64)}` as const;

describe("ConfirmationWorker", () => {
  function pending() {
    return { chainId: "31337", txHash: hash("1"), blockNumber: "10", blockHash: hash("2") };
  }

  function repository(executions = [pending()]) {
    return {
      listPendingConfirmations: vi.fn().mockResolvedValue(executions),
      persistCanonicalEvidence: vi.fn(),
      invalidateReorgedEvidence: vi.fn(),
      updateConfirmations: vi.fn(),
    };
  }

  it("requests only pending executions for its configured chain", async () => {
    const storage = repository([]);
    const worker = new ConfirmationWorker({
      chainId: "11155111",
      chain: {
        getBlockHash: vi.fn(),
        getBlockNumber: vi.fn(),
        readCanonicalEvidence: vi.fn(),
      },
      repository: storage,
      confirmationDepth: 2,
      batchSize: 10,
    });

    await worker.runOnce();

    expect(storage.listPendingConfirmations).toHaveBeenCalledWith("11155111", 10);
  });

  it("defers evidence until configured confirmation depth is reached", async () => {
    const execution = pending();
    const storage = repository([execution]);
    const chain = {
      getBlockHash: vi.fn().mockResolvedValue(execution.blockHash),
      getBlockNumber: vi.fn().mockResolvedValue(10n),
      readCanonicalEvidence: vi.fn(),
    };
    const worker = new ConfirmationWorker({
      chainId: "31337",
      chain,
      repository: storage,
      confirmationDepth: 2,
      batchSize: 10,
    });

    await expect(worker.runOnce()).resolves.toEqual({
      deferred: 1,
      errors: 0,
      persisted: 0,
      reorged: 0,
    });
    expect(storage.persistCanonicalEvidence).not.toHaveBeenCalled();
    expect(storage.updateConfirmations).toHaveBeenCalledWith(execution, 1);
  });

  it("persists one canonical evidence bundle when confirmation depth is reached", async () => {
    const execution = pending();
    const storage = repository([execution]);
    const evidence = { version: 1, txHash: execution.txHash };
    const chain = {
      getBlockHash: vi.fn().mockResolvedValue(execution.blockHash),
      getBlockNumber: vi.fn().mockResolvedValue(11n),
      readCanonicalEvidence: vi.fn().mockResolvedValue(evidence),
    };
    const worker = new ConfirmationWorker({
      chainId: "31337",
      chain,
      repository: storage,
      confirmationDepth: 2,
      batchSize: 10,
    });

    await expect(worker.runOnce()).resolves.toEqual({
      deferred: 0,
      errors: 0,
      persisted: 1,
      reorged: 0,
    });
    expect(storage.updateConfirmations).toHaveBeenCalledWith(execution, 2);
    expect(storage.persistCanonicalEvidence).toHaveBeenCalledWith(evidence);
  });

  it("invalidates evidence when canonical ancestry replaces the recorded block hash", async () => {
    const execution = pending();
    const storage = repository([execution]);
    const chain = {
      getBlockHash: vi.fn().mockResolvedValue(hash("3")),
      getBlockNumber: vi.fn(),
      readCanonicalEvidence: vi.fn(),
    };
    const worker = new ConfirmationWorker({
      chainId: "31337",
      chain,
      repository: storage,
      confirmationDepth: 2,
      batchSize: 10,
    });

    await expect(worker.runOnce()).resolves.toEqual({
      deferred: 0,
      errors: 0,
      persisted: 0,
      reorged: 1,
    });
    expect(storage.invalidateReorgedEvidence).toHaveBeenCalledWith(
      expect.objectContaining({
        canonicalBlockHash: hash("3"),
        reason: "BLOCK_HASH_REPLACED",
      }),
    );
  });

  it("invalidates an observed execution when its canonical block disappears", async () => {
    const execution = pending();
    const storage = repository([execution]);
    const chain = {
      getBlockHash: vi.fn().mockResolvedValue(null),
      getBlockNumber: vi.fn(),
      readCanonicalEvidence: vi.fn(),
    };
    const worker = new ConfirmationWorker({
      chainId: "31337",
      chain,
      repository: storage,
      confirmationDepth: 2,
      batchSize: 10,
    });

    await worker.runOnce();

    expect(storage.invalidateReorgedEvidence).toHaveBeenCalledWith(
      expect.objectContaining({
        canonicalBlockHash: null,
        reason: "RECEIPT_DISAPPEARED",
      }),
    );
  });

  it("invalidates when a previously observed receipt disappears after confirmation", async () => {
    const execution = pending();
    const storage = repository([execution]);
    const chain = {
      getBlockHash: vi.fn().mockResolvedValue(execution.blockHash),
      getBlockNumber: vi.fn().mockResolvedValue(11n),
      readCanonicalEvidence: vi
        .fn()
        .mockRejectedValue(new ChainReadError("NOT_FOUND", "receipt not found")),
    };
    const worker = new ConfirmationWorker({
      chainId: "31337",
      chain,
      repository: storage,
      confirmationDepth: 2,
      batchSize: 10,
    });

    await expect(worker.runOnce()).resolves.toEqual({
      deferred: 0,
      errors: 0,
      persisted: 0,
      reorged: 1,
    });
    expect(storage.invalidateReorgedEvidence).toHaveBeenCalledWith(
      expect.objectContaining({ canonicalBlockHash: null, reason: "RECEIPT_DISAPPEARED" }),
    );
  });

  it("keeps RPC failures retryable and never persists a compliant audit", async () => {
    const first = pending();
    const second = { ...pending(), txHash: hash("4") };
    const storage = repository([first, second]);
    const chain = {
      getBlockHash: vi
        .fn()
        .mockRejectedValueOnce(new ChainReadError("UNAVAILABLE", "RPC unavailable"))
        .mockResolvedValueOnce(second.blockHash),
      getBlockNumber: vi.fn().mockResolvedValue(10n),
      readCanonicalEvidence: vi.fn(),
    };
    const worker = new ConfirmationWorker({
      chainId: "31337",
      chain,
      repository: storage,
      confirmationDepth: 2,
      batchSize: 10,
    });

    await expect(worker.runOnce()).resolves.toEqual({
      deferred: 1,
      errors: 1,
      persisted: 0,
      reorged: 0,
    });
    expect(storage.persistCanonicalEvidence).not.toHaveBeenCalled();
  });
});
