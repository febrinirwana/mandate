type Hash = `0x${string}`;

export interface PendingExecution {
  chainId: string;
  txHash: Hash;
  blockNumber: string;
  blockHash: Hash;
}

export interface ConfirmationWorkerDependencies {
  chain: {
    getBlockHash(chainId: string, blockNumber: bigint): Promise<Hash | null>;
    getBlockNumber(chainId: string): Promise<bigint>;
    readCanonicalEvidence(input: { chainId: string; txHash: Hash }): Promise<unknown>;
  };
  repository: {
    listPendingConfirmations(limit: number): Promise<readonly PendingExecution[]>;
    updateConfirmations(chainId: string, txHash: Hash, confirmations: number): Promise<void>;
    persistCanonicalEvidence(evidence: unknown): Promise<void>;
    invalidateReorgedEvidence(input: {
      chainId: string;
      txHash: Hash;
      replacedBlockHash: Hash;
      canonicalBlockHash: Hash | null;
      reason: "BLOCK_HASH_REPLACED" | "RECEIPT_DISAPPEARED";
    }): Promise<void>;
  };
  confirmationDepth: number;
  batchSize: number;
}

export interface WorkerRunResult {
  deferred: number;
  persisted: number;
  reorged: number;
}

export class ConfirmationWorker {
  constructor(private readonly dependencies: ConfirmationWorkerDependencies) {
    if (!Number.isInteger(dependencies.confirmationDepth) || dependencies.confirmationDepth < 0) {
      throw new Error("confirmationDepth must be a nonnegative integer");
    }
    if (!Number.isInteger(dependencies.batchSize) || dependencies.batchSize < 1) {
      throw new Error("batchSize must be a positive integer");
    }
  }

  async runOnce(): Promise<WorkerRunResult> {
    const result: WorkerRunResult = { deferred: 0, persisted: 0, reorged: 0 };
    const pending = await this.dependencies.repository.listPendingConfirmations(
      this.dependencies.batchSize,
    );
    for (const execution of pending) {
      const blockNumber = BigInt(execution.blockNumber);
      const canonicalHash = await this.dependencies.chain.getBlockHash(
        execution.chainId,
        blockNumber,
      );
      if (canonicalHash !== execution.blockHash) {
        await this.dependencies.repository.invalidateReorgedEvidence({
          chainId: execution.chainId,
          txHash: execution.txHash,
          replacedBlockHash: execution.blockHash,
          canonicalBlockHash: canonicalHash,
          reason: canonicalHash ? "BLOCK_HASH_REPLACED" : "RECEIPT_DISAPPEARED",
        });
        result.reorged++;
        continue;
      }
      const head = await this.dependencies.chain.getBlockNumber(execution.chainId);
      const confirmations = head >= blockNumber ? Number(head - blockNumber) : 0;
      await this.dependencies.repository.updateConfirmations(
        execution.chainId,
        execution.txHash,
        confirmations,
      );
      if (confirmations < this.dependencies.confirmationDepth) {
        result.deferred++;
        continue;
      }
      await this.dependencies.repository.persistCanonicalEvidence(
        await this.dependencies.chain.readCanonicalEvidence({
          chainId: execution.chainId,
          txHash: execution.txHash,
        }),
      );
      result.persisted++;
    }
    return result;
  }
}
