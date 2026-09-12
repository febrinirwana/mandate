import { ChainReadError } from "@mandate/chain";
import type { CanonicalReceiptEvidenceV1 } from "@mandate/domain";
import type {
  CanonicalEvidenceRepository,
  PendingExecution,
  ReorgInvalidationInput,
} from "@mandate/db";

type Hash = `0x${string}`;

export interface ConfirmationWorkerDependencies {
  chainId: string;
  chain: {
    getBlockHash(chainId: string, blockNumber: bigint): Promise<Hash | null>;
    getBlockNumber(chainId: string): Promise<bigint>;
    readCanonicalEvidence(input: {
      chainId: string;
      txHash: Hash;
    }): Promise<CanonicalReceiptEvidenceV1>;
  };
  repository: Pick<
    CanonicalEvidenceRepository,
    | "listPendingConfirmations"
    | "updateConfirmations"
    | "persistCanonicalEvidence"
    | "invalidateReorgedEvidence"
  >;
  confirmationDepth: number;
  batchSize: number;
}

export interface WorkerRunResult {
  deferred: number;
  errors: number;
  persisted: number;
  reorged: number;
}

const MAX_CONFIRMATION_COUNT = 2_147_483_647n;

function invalidation(
  execution: PendingExecution,
  canonicalBlockHash: Hash | null,
): ReorgInvalidationInput {
  return {
    chainId: execution.chainId,
    txHash: execution.txHash,
    replacedBlockHash: execution.blockHash,
    canonicalBlockHash,
    reason: canonicalBlockHash ? "BLOCK_HASH_REPLACED" : "RECEIPT_DISAPPEARED",
  };
}

export class ConfirmationWorker {
  constructor(private readonly dependencies: ConfirmationWorkerDependencies) {
    if (!Number.isInteger(dependencies.confirmationDepth) || dependencies.confirmationDepth < 0) {
      throw new Error("confirmationDepth must be a nonnegative integer");
    }
    if (!Number.isInteger(dependencies.batchSize) || dependencies.batchSize < 1) {
      throw new Error("batchSize must be a positive integer");
    }
    if (!/^[1-9][0-9]*$/.test(dependencies.chainId)) {
      throw new Error("chainId must be a positive integer string");
    }
  }

  async runOnce(): Promise<WorkerRunResult> {
    const result: WorkerRunResult = { deferred: 0, errors: 0, persisted: 0, reorged: 0 };
    const pending = await this.dependencies.repository.listPendingConfirmations(
      this.dependencies.chainId,
      this.dependencies.batchSize,
    );

    for (const execution of pending) {
      try {
        const blockNumber = BigInt(execution.blockNumber);
        const canonicalHash = await this.dependencies.chain.getBlockHash(
          execution.chainId,
          blockNumber,
        );
        if (canonicalHash !== execution.blockHash) {
          await this.dependencies.repository.invalidateReorgedEvidence(
            invalidation(execution, canonicalHash),
          );
          result.reorged++;
          continue;
        }

        const head = await this.dependencies.chain.getBlockNumber(execution.chainId);
        const distance = head >= blockNumber ? head - blockNumber + 1n : 0n;
        const confirmations = Number(
          distance > MAX_CONFIRMATION_COUNT ? MAX_CONFIRMATION_COUNT : distance,
        );
        await this.dependencies.repository.updateConfirmations(execution, confirmations);
        if (confirmations < this.dependencies.confirmationDepth) {
          result.deferred++;
          continue;
        }

        try {
          const evidence = await this.dependencies.chain.readCanonicalEvidence({
            chainId: execution.chainId,
            txHash: execution.txHash,
          });
          await this.dependencies.repository.persistCanonicalEvidence(evidence);
          result.persisted++;
        } catch (error) {
          if (error instanceof ChainReadError && error.kind === "NOT_FOUND") {
            await this.dependencies.repository.invalidateReorgedEvidence(
              invalidation(execution, null),
            );
            result.reorged++;
          } else {
            throw error;
          }
        }
      } catch {
        result.errors++;
      }
    }
    return result;
  }
}

export interface ConfirmationWorkerLoop {
  stop(): Promise<void>;
}

export function startConfirmationWorker(
  worker: ConfirmationWorker,
  options: {
    pollIntervalMs: number;
    onResult: (result: WorkerRunResult) => void;
    onError: (error: unknown) => void;
  },
): ConfirmationWorkerLoop {
  if (!Number.isInteger(options.pollIntervalMs) || options.pollIntervalMs < 1) {
    throw new Error("pollIntervalMs must be a positive integer");
  }

  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  let active = Promise.resolve();
  const tick = (): void => {
    active = worker
      .runOnce()
      .then(options.onResult)
      .catch(options.onError)
      .finally(() => {
        if (!stopped) timer = setTimeout(tick, options.pollIntervalMs);
      });
  };
  tick();

  return {
    async stop() {
      stopped = true;
      clearTimeout(timer);
      await active;
    },
  };
}
