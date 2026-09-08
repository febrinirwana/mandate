import { loadEnvFile } from "node:process";

import { and, count, eq } from "drizzle-orm";
import type { CanonicalReceiptEvidenceV1 } from "@mandate/domain";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabase } from "../src/index.js";
import { createCanonicalEvidenceRepository } from "../src/evidence.js";
import {
  auditEvidence,
  audits,
  balanceDeltas,
  contractDeployments,
  evidenceInvalidations,
  executionEvents,
  executions,
  strategies,
} from "../src/schema.js";

try {
  loadEnvFile("../../.env");
} catch {
  // CI may inject DATABASE_URL directly or skip this integration suite.
}

const databaseUrl = process.env["TEST_DATABASE_URL"] ?? process.env["DATABASE_URL"];
const integrationEnabled = Boolean(databaseUrl && !databaseUrl.includes("replace_me"));
const chainId = "99999999999999999999999999999999999999999999999999999999999999999999999999999";
const address = (digit: string): `0x${string}` => `0x${digit.repeat(40)}`;
const hash = (digit: string): `0x${string}` => `0x${digit.repeat(64)}`;

function evidence(blockHash = hash("b"), txHash = hash("a")): CanonicalReceiptEvidenceV1 {
  return {
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
      chainId,
      txHash,
      block: { number: "2", hash: blockHash },
      transactionIndex: "0",
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
      chainId,
      txHash,
      block: { number: "2", hash: blockHash },
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
        afterBlock: { number: "2", hash: blockHash },
        before: "10",
        after: "0",
        delta: "-10",
        source: "RPC_CALL",
      },
    ],
  };
}

const suite = integrationEnabled ? describe : describe.skip;

suite("canonical evidence PostgreSQL integration", () => {
  const database = createDatabase(databaseUrl);
  const repository = createCanonicalEvidenceRepository(database.db);

  async function clearFixtures(): Promise<void> {
    await database.db.delete(auditEvidence).where(eq(auditEvidence.chainId, chainId));
    await database.db
      .delete(evidenceInvalidations)
      .where(eq(evidenceInvalidations.chainId, chainId));
    await database.db.delete(contractDeployments).where(eq(contractDeployments.chainId, chainId));
    await database.db.delete(audits).where(eq(audits.chainId, chainId));
    await database.db.delete(balanceDeltas).where(eq(balanceDeltas.chainId, chainId));
    await database.db.delete(executionEvents).where(eq(executionEvents.chainId, chainId));
    await database.db.delete(executions).where(eq(executions.chainId, chainId));
    await database.db.delete(strategies).where(eq(strategies.chainId, chainId));
  }

  beforeAll(clearFixtures);
  afterAll(async () => {
    await clearFixtures();
    await database.close();
  });

  it("keeps deployment provenance append-only and enforces exact boundary codecs", async () => {
    const deployment = {
      chainId,
      kind: "MANDATE_APP",
      address: address("1"),
      codeHash: hash("2"),
      sourceRevision: "git-revision",
      official: false,
      verifiedAtBlock: "2",
      verifiedAtHash: hash("3"),
    } as const;

    await database.db.insert(contractDeployments).values(deployment);
    await database.db.insert(contractDeployments).values(deployment).onConflictDoNothing();

    const [deploymentCount] = await database.db
      .select({ value: count() })
      .from(contractDeployments)
      .where(eq(contractDeployments.chainId, chainId));
    expect(deploymentCount?.value).toBe(1);
    await expect(
      database.db
        .insert(contractDeployments)
        .values({ ...deployment, address: `0x${"A".repeat(40)}`, codeHash: hash("4") }),
    ).rejects.toThrow();
  });

  it("rejects orphan receipt evidence without a matching execution inclusion", async () => {
    await expect(
      database.db.insert(executionEvents).values({
        chainId,
        blockHash: hash("a"),
        txHash: hash("9"),
        logIndex: "0",
        contract: address("1"),
        topic0: null,
        topics: [],
        data: "0x",
        kind: "RAW_LOG",
        decoded: {},
        decoderVersion: 1,
      }),
    ).rejects.toThrow();
  });
  it("tracks one observed execution until the worker commits its canonical bundle", async () => {
    const input = evidence(hash("2"), hash("3"));

    await repository.trackObservedExecution(input.execution);
    await repository.trackObservedExecution(input.execution);
    const [pending] = await repository.listPendingConfirmations(10);
    expect(pending).toEqual({
      chainId,
      txHash: input.execution.txHash,
      blockNumber: input.execution.block.number,
      blockHash: input.execution.block.hash,
    });

    await repository.updateConfirmations(pending!, 4);
    await repository.persistCanonicalEvidence(input);

    const rows = await database.db
      .select({
        status: executions.status,
        confirmationCount: executions.confirmationCount,
      })
      .from(executions)
      .where(
        and(
          eq(executions.chainId, chainId),
          eq(executions.txHash, input.execution.txHash),
          eq(executions.blockHash, input.execution.block.hash),
        ),
      );
    expect(rows).toEqual([{ status: "CONFIRMED", confirmationCount: 4 }]);
    await expect(repository.listPendingConfirmations(10)).resolves.not.toContainEqual(pending);
  });

  it("replays the same receipt without duplicate evidence rows", async () => {
    const input = evidence();

    await repository.persistCanonicalEvidence(input);
    await repository.persistCanonicalEvidence(input);

    const [executionCount] = await database.db
      .select({ value: count() })
      .from(executions)
      .where(and(eq(executions.chainId, chainId), eq(executions.txHash, input.execution.txHash)));
    const [eventCount] = await database.db
      .select({ value: count() })
      .from(executionEvents)
      .where(
        and(
          eq(executionEvents.chainId, chainId),
          eq(executionEvents.txHash, input.execution.txHash),
        ),
      );
    const [deltaCount] = await database.db
      .select({ value: count() })
      .from(balanceDeltas)
      .where(
        and(eq(balanceDeltas.chainId, chainId), eq(balanceDeltas.txHash, input.execution.txHash)),
      );
    const [auditCount] = await database.db
      .select({ value: count() })
      .from(audits)
      .where(and(eq(audits.chainId, chainId), eq(audits.txHash, input.execution.txHash)));
    const [citationCount] = await database.db
      .select({ value: count() })
      .from(auditEvidence)
      .where(
        and(eq(auditEvidence.chainId, chainId), eq(auditEvidence.txHash, input.execution.txHash)),
      );

    expect({
      executions: executionCount?.value,
      events: eventCount?.value,
      deltas: deltaCount?.value,
      audits: auditCount?.value,
      citations: citationCount?.value,
    }).toEqual({ executions: 1, events: 1, deltas: 1, audits: 1, citations: 1 });
  });

  it("retains invalidated history and persists replacement-block evidence independently", async () => {
    const txHash = hash("4");
    const replacedBlockHash = hash("5");
    const canonicalBlockHash = hash("6");
    await repository.persistCanonicalEvidence(evidence(replacedBlockHash, txHash));

    await repository.invalidateReorgedEvidence({
      chainId,
      txHash,
      replacedBlockHash,
      canonicalBlockHash,
      reason: "BLOCK_HASH_REPLACED",
    });
    await repository.persistCanonicalEvidence(evidence(replacedBlockHash, txHash));
    await repository.persistCanonicalEvidence(evidence(canonicalBlockHash, txHash));

    const executionRows = await database.db
      .select({ blockHash: executions.blockHash, status: executions.status })
      .from(executions)
      .where(and(eq(executions.chainId, chainId), eq(executions.txHash, txHash)));
    const auditRows = await database.db
      .select({ blockHash: audits.blockHash, invalidatedAt: audits.invalidatedAt })
      .from(audits)
      .where(and(eq(audits.chainId, chainId), eq(audits.txHash, txHash)));

    expect(executionRows).toEqual(
      expect.arrayContaining([
        { blockHash: replacedBlockHash, status: "REORGED" },
        { blockHash: canonicalBlockHash, status: "CONFIRMED" },
      ]),
    );
    expect(
      auditRows.find((row) => row.blockHash === replacedBlockHash)?.invalidatedAt,
    ).toBeInstanceOf(Date);
    expect(auditRows).toContainEqual({
      blockHash: canonicalBlockHash,
      invalidatedAt: null,
    });
  });

  it("rolls back parent evidence when a child row violates a database constraint", async () => {
    const txHash = hash("7");
    const invalid = evidence(hash("8"), txHash);
    invalid.events[0] = { ...invalid.events[0]!, decoderVersion: 2_147_483_648 };

    await expect(repository.persistCanonicalEvidence(invalid)).rejects.toThrow();

    const [executionCount] = await database.db
      .select({ value: count() })
      .from(executions)
      .where(and(eq(executions.chainId, chainId), eq(executions.txHash, txHash)));
    expect(executionCount?.value).toBe(0);
  });
});
