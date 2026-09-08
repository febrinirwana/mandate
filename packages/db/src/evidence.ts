import { and, asc, eq, sql } from "drizzle-orm";

import {
  CanonicalReceiptEvidenceV1Schema,
  ExecutionV1Schema,
  type CanonicalReceiptEvidenceV1,
  type ExecutionV1,
} from "@mandate/domain";
import type { DatabaseConnection } from "./index.js";
import {
  auditEvidence,
  audits,
  balanceDeltas,
  evidenceInvalidations,
  executionEvents,
  executions,
  strategies,
} from "./schema.js";

const sensitiveFieldNames = new Set([
  "apikey",
  "authorization",
  "bearer",
  "mnemonic",
  "password",
  "privatekey",
  "rawsignedtransaction",
  "signedtransaction",
]);

function inspectValue(value: unknown, seen: WeakSet<object>): void {
  if (typeof value === "string") {
    if (/^bearer\s+/i.test(value)) {
      throw new Error("sensitive evidence value is not persistable");
    }
    try {
      const url = new URL(value);
      if (url.username || url.password) {
        throw new Error("credential-bearing URL is not persistable");
      }
    } catch (error) {
      if (error instanceof Error && error.message === "credential-bearing URL is not persistable") {
        throw error;
      }
    }
    return;
  }
  if (!value || typeof value !== "object" || seen.has(value)) return;

  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item) => inspectValue(item, seen));
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (sensitiveFieldNames.has(key.replace(/[^a-z0-9]/gi, "").toLowerCase())) {
      throw new Error(`sensitive evidence field is not persistable: ${key}`);
    }
    inspectValue(child, seen);
  }
}

export function assertPersistableEvidence(value: unknown): CanonicalReceiptEvidenceV1 {
  inspectValue(value, new WeakSet<object>());
  return CanonicalReceiptEvidenceV1Schema.parse(value);
}

export interface CanonicalEvidenceRepository {
  trackObservedExecution(input: ExecutionV1): Promise<void>;
  listPendingConfirmations(limit: number): Promise<readonly PendingExecution[]>;
  updateConfirmations(input: PendingExecution, confirmations: number): Promise<void>;
  persistCanonicalEvidence(input: CanonicalReceiptEvidenceV1): Promise<void>;
  invalidateReorgedEvidence(input: ReorgInvalidationInput): Promise<void>;
}

export interface PendingExecution {
  chainId: string;
  txHash: `0x${string}`;
  blockNumber: string;
  blockHash: `0x${string}`;
}

export interface ReorgInvalidationInput {
  chainId: string;
  txHash: `0x${string}`;
  replacedBlockHash: `0x${string}`;
  canonicalBlockHash: `0x${string}` | null;
  reason: "BLOCK_HASH_REPLACED" | "RECEIPT_DISAPPEARED";
}

export function createCanonicalEvidenceRepository(
  db: DatabaseConnection["db"],
): CanonicalEvidenceRepository {
  return {
    async trackObservedExecution(input) {
      const execution = ExecutionV1Schema.parse(input);
      if (execution.status !== "CONFIRMED") {
        throw new Error("only a canonical observed execution can be tracked");
      }
      await db
        .insert(executions)
        .values({
          chainId: execution.chainId,
          txHash: execution.txHash,
          strategyHash: execution.strategyHash,
          caller: execution.caller,
          amountIn: execution.amountIn,
          amountOut: execution.amountOut,
          usedInputAfter: execution.usedInputAfter,
          status: "SUBMITTED",
          blockNumber: execution.block.number,
          blockHash: execution.block.hash,
          transactionIndex: execution.transactionIndex,
        })
        .onConflictDoNothing();
    },
    async listPendingConfirmations(limit) {
      if (!Number.isInteger(limit) || limit < 1) {
        throw new Error("limit must be a positive integer");
      }
      return db
        .select({
          chainId: executions.chainId,
          txHash: executions.txHash,
          blockNumber: executions.blockNumber,
          blockHash: executions.blockHash,
        })
        .from(executions)
        .where(eq(executions.status, "SUBMITTED"))
        .orderBy(asc(executions.createdAt))
        .limit(limit) as Promise<PendingExecution[]>;
    },
    async updateConfirmations(input, confirmations) {
      if (!Number.isInteger(confirmations) || confirmations < 0) {
        throw new Error("confirmations must be a nonnegative integer");
      }
      await db
        .update(executions)
        .set({ confirmationCount: confirmations })
        .where(
          and(
            eq(executions.chainId, input.chainId),
            eq(executions.txHash, input.txHash),
            eq(executions.blockHash, input.blockHash),
            eq(executions.status, "SUBMITTED"),
          ),
        );
    },
    async persistCanonicalEvidence(input) {
      const evidence = assertPersistableEvidence(input);
      await db.transaction(async (tx) => {
        await tx
          .insert(strategies)
          .values({
            chainId: evidence.execution.chainId,
            strategyHash: evidence.execution.strategyHash,
            definition: evidence.strategy,
          })
          .onConflictDoNothing();
        await tx
          .insert(executions)
          .values({
            chainId: evidence.execution.chainId,
            txHash: evidence.execution.txHash,
            strategyHash: evidence.execution.strategyHash,
            caller: evidence.execution.caller,
            amountIn: evidence.execution.amountIn,
            amountOut: evidence.execution.amountOut,
            usedInputAfter: evidence.execution.usedInputAfter,
            status: evidence.execution.status,
            blockNumber: evidence.execution.block.number,
            blockHash: evidence.execution.block.hash,
            transactionIndex: evidence.execution.transactionIndex,
          })
          .onConflictDoNothing();
        await tx
          .update(executions)
          .set({ status: "CONFIRMED" })
          .where(
            and(
              eq(executions.chainId, evidence.execution.chainId),
              eq(executions.txHash, evidence.execution.txHash),
              eq(executions.blockHash, evidence.execution.block.hash),
              eq(executions.status, "SUBMITTED"),
            ),
          );
        if (evidence.events.length > 0) {
          await tx
            .insert(executionEvents)
            .values(
              evidence.events.map((event) => ({
                chainId: evidence.execution.chainId,
                blockHash: evidence.execution.block.hash,
                txHash: evidence.execution.txHash,
                logIndex: event.logIndex,
                contract: event.contract,
                topic0: event.topic0,
                topics: event.topics,
                data: event.data,
                kind: event.kind,
                decoded: event.decoded,
                decoderVersion: event.decoderVersion,
              })),
            )
            .onConflictDoNothing();
        }
        if (evidence.balanceDeltas.length > 0) {
          await tx
            .insert(balanceDeltas)
            .values(
              evidence.balanceDeltas.map((delta) => ({
                chainId: evidence.execution.chainId,
                txHash: evidence.execution.txHash,
                blockHash: evidence.execution.block.hash,
                account: delta.account,
                token: delta.token,
                source: delta.source,
                beforeBlockNumber: delta.beforeBlock.number,
                beforeBlockHash: delta.beforeBlock.hash,
                before: delta.before,
                after: delta.after,
                delta: delta.delta,
              })),
            )
            .onConflictDoNothing();
        }
        await tx
          .insert(audits)
          .values({
            chainId: evidence.audit.chainId,
            txHash: evidence.audit.txHash,
            blockHash: evidence.audit.block.hash,
            auditVersion: evidence.audit.version,
            result: evidence.audit.result,
            checks: evidence.audit.checks,
          })
          .onConflictDoNothing();
        await tx
          .insert(auditEvidence)
          .values(
            evidence.audit.evidence.map((item, ordinal) => ({
              chainId: evidence.audit.chainId,
              txHash: evidence.audit.txHash,
              blockHash: evidence.audit.block.hash,
              auditVersion: evidence.audit.version,
              ordinal,
              provider: item.provider,
              responseHash: item.responseHash,
            })),
          )
          .onConflictDoNothing();
      });
    },
    async invalidateReorgedEvidence(input) {
      await db.transaction(async (tx) => {
        await tx
          .update(executions)
          .set({ status: "REORGED" })
          .where(
            and(
              eq(executions.chainId, input.chainId),
              eq(executions.txHash, input.txHash),
              eq(executions.blockHash, input.replacedBlockHash),
            ),
          );
        await tx
          .update(audits)
          .set({
            invalidatedAt: sql`coalesce(${audits.invalidatedAt}, now())`,
            invalidationReason: input.reason,
          })
          .where(
            and(
              eq(audits.chainId, input.chainId),
              eq(audits.txHash, input.txHash),
              eq(audits.blockHash, input.replacedBlockHash),
            ),
          );
        await tx.insert(evidenceInvalidations).values(input).onConflictDoNothing();
      });
    },
  };
}
