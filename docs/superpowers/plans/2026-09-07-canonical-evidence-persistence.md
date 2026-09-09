# Canonical Evidence Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist confirmed Mandate receipt evidence atomically, replay it idempotently, and preserve—but invalidate—evidence whose block hash is replaced by a reorganization.

**Architecture:** `@mandate/domain` defines validated, secret-free canonical evidence values. `@mandate/chain` constructs those values from an explicitly canonical receipt and historical reads. `@mandate/db` owns append-only PostgreSQL tables, codecs, and transactions. A small Node `apps/worker` polls pending transaction records, checks confirmation depth and canonical ancestry, then calls the repository. PostgreSQL is a projection only; chain state remains authoritative.

**Tech Stack:** TypeScript 5.9, Zod 4, viem 2, Drizzle ORM/Kit 0.45/0.31, postgres.js 3.4, Vitest 5, PostgreSQL 16 local / Supabase PostgreSQL 17 remote.

**Spec:** `docs/superpowers/specs/2026-09-07-canonical-evidence-design.md`

## Global Constraints

- All blockchain integers cross JSON and database boundaries as decimal strings or `numeric(78,0)`; never JavaScript `number`.
- Hashes and addresses are lowercase validated hex at persistence boundaries.
- The worker has no signer, private key, generic transaction method, or raw-RPC endpoint.
- A database failure may make evidence unavailable but can never change a chain `FAIL`/`UNKNOWN` into `PASS` or an audit into `COMPLIANT`.
- Existing `simulation_evidence` is advisory and remains separate from receipt evidence.
- Strategies and deployments are append-only. Reorg invalidation records history rather than deleting it.
- Do not add Redis, a queue service, or a Supabase Edge Function. PostgreSQL polling is sufficient at this scope.
- Do not log or persist private keys, mnemonics, bearer credentials, RPC URLs containing credentials, raw signed transactions, or authorization headers.

---

### Task 1: Define canonical evidence domain values

**Files:**

- Modify: `packages/domain/src/index.ts`
- Modify: `packages/domain/test/domain.test.ts`

**Interfaces:**

- Produces `CanonicalReceiptEvidenceV1Schema`, `ExecutionEventEvidenceV1Schema`, `BalanceDeltaEvidenceV1Schema`, `AuditEvidenceRecordV1Schema`, `CanonicalReceiptEvidenceV1`, and `PersistableAuditResult` for `@mandate/chain` and `@mandate/db`.
- Consumes existing `ExecutionV1Schema`, `ReceiptAuditV1Schema`, `StrategyV1Schema`, `BlockRefSchema`, `AddressSchema`, `Hash32Schema`, and decimal-string schemas.

- [ ] **Step 1: Write failing domain tests for a valid canonical evidence bundle**

```ts
const result = CanonicalReceiptEvidenceV1Schema.safeParse({
  version: 1,
  execution: confirmedExecution,
  strategy,
  audit,
  events: [
    {
      logIndex: "0",
      contract: mandateApp,
      topic0,
      topics: [topic0],
      data: "0x",
      kind: "MandateExecuted",
      decoded: { strategyHash },
      decoderVersion: 1,
    },
  ],
  balanceDeltas: [
    {
      account: maker,
      token: tokenIn,
      beforeBlock,
      afterBlock,
      before: "10",
      after: "0",
      delta: "-10",
      source: "RPC_CALL",
    },
  ],
});
expect(result.success).toBe(true);
```

- [ ] **Step 2: Run the focused test and verify it fails because the schema is absent**

Run: `pnpm --filter @mandate/domain test -- --runInBand`

Expected: the new test fails with `CanonicalReceiptEvidenceV1Schema` missing.

- [ ] **Step 3: Add minimal strict schemas and inferred types**

```ts
export const BalanceDeltaEvidenceV1Schema = z.strictObject({
  account: NonZeroAddressSchema,
  token: NonZeroAddressSchema,
  beforeBlock: BlockRefSchema,
  afterBlock: BlockRefSchema,
  before: Uint256StringSchema,
  after: Uint256StringSchema,
  delta: z.string().regex(/^-?(?:0|[1-9][0-9]*)$/),
  source: z.enum(["RPC_CALL", "EVENT_RECONSTRUCTION"]),
});
```

Require `execution.status === "CONFIRMED"`, `execution.block === audit.block`, and `execution.strategyHash === audit.strategyHash` through `superRefine`. Reject unknown fields and noncanonical/nondecimal values.

- [ ] **Step 4: Add failing tests for inconsistent execution/audit binding and malformed public evidence**

```ts
expect(() =>
  CanonicalReceiptEvidenceV1Schema.parse({
    ...valid,
    audit: { ...valid.audit, txHash: otherTxHash },
  }),
).toThrow();
expect(() =>
  CanonicalReceiptEvidenceV1Schema.parse({
    ...valid,
    events: [{ ...valid.events[0], data: "0x0" }],
  }),
).toThrow();
```

- [ ] **Step 5: Implement the smallest refinements that make the domain tests pass**

Use existing strict schemas. Do not introduce another address/hash parser or a generic JSON blob schema.

- [ ] **Step 6: Run focused domain verification**

Run: `pnpm --filter @mandate/domain test && pnpm --filter @mandate/domain typecheck`

Expected: domain tests and typecheck pass.

- [ ] **Step 7: Commit the domain contract**

```bash
git add packages/domain/src/index.ts packages/domain/test/domain.test.ts
git commit -m "feat: define canonical receipt evidence"
```

### Task 2: Construct canonical evidence from block-bound chain reads

**Files:**

- Modify: `packages/chain/src/mandate.ts`
- Modify: `packages/chain/src/index.ts`
- Modify: `packages/chain/test/mandate.test.ts`

**Interfaces:**

- Consumes `CanonicalReceiptEvidenceV1Schema` and existing `MandateChainService` runtime configuration.
- Produces `MandateChainService.readCanonicalEvidence({ chainId, txHash }): Promise<CanonicalReceiptEvidenceV1>`.
- The worker calls this only after canonicality and confirmation checks.

- [ ] **Step 1: Write a failing chain test for canonical receipt evidence**

```ts
const evidence = await service.readCanonicalEvidence({ chainId: "31337", txHash });
expect(evidence.execution.status).toBe("CONFIRMED");
expect(evidence.events).toHaveLength(1);
expect(evidence.audit.block).toEqual(evidence.execution.block);
expect(
  evidence.balanceDeltas.every((delta) => delta.beforeBlock.number !== delta.afterBlock.number),
).toBe(true);
```

- [ ] **Step 2: Run the focused test and verify it fails because `readCanonicalEvidence` is absent**

Run: `pnpm --filter @mandate/chain test -- mandate.test.ts`

Expected: failure references missing `readCanonicalEvidence`.

- [ ] **Step 3: Extract a single receipt-evidence reader from existing audit logic**

Implement `readCanonicalEvidence` by:

1. loading receipt and transaction once;
2. comparing `getBlock({ blockNumber: receipt.blockNumber }).hash` with `receipt.blockHash` before returning evidence;
3. decoding every receipt log into immutable raw topics/data plus decoder metadata;
4. using `blockNumber - 1` and `blockNumber` for the exact physical and Aqua balance observations already used in `auditReceipt`;
5. deriving signed decimal deltas from exact `bigint` subtraction;
6. calling the shared receipt-audit routine, not duplicating policy decisions.

If a required historical read is unavailable, return a schema-valid bundle whose audit is `UNKNOWN`; do not fabricate a balance delta.

- [ ] **Step 4: Add failing tests for noncanonical and undecodable receipts**

```ts
await expect(
  service.readCanonicalEvidence({ chainId: "31337", txHash: reorgedTxHash }),
).rejects.toMatchObject({ kind: "UNAVAILABLE" });
expect(
  (await service.readCanonicalEvidence({ chainId: "31337", txHash: undecodableTxHash })).audit
    .result,
).toBe("UNKNOWN");
```

- [ ] **Step 5: Implement only the error handling required by those tests**

Reuse `ChainReadError`; do not add a generic event-decoder registry. Preserve exact source hashes and block references in the returned evidence.

- [ ] **Step 6: Run focused chain verification**

Run: `pnpm --filter @mandate/chain test && pnpm --filter @mandate/chain typecheck`

Expected: existing and new receipt tests pass.

- [ ] **Step 7: Commit the chain evidence reader**

```bash
git add packages/chain/src packages/chain/test/mandate.test.ts packages/domain/src/index.ts
git commit -m "feat: collect block-bound receipt evidence"
```

### Task 3: Add append-only Drizzle evidence schema and codecs

**Files:**

- Modify: `packages/db/src/schema.ts`
- Create: `packages/db/src/evidence.ts`
- Modify: `packages/db/src/index.ts`
- Create: `packages/db/drizzle/0001_canonical_evidence.sql`
- Modify: `packages/db/test/database.test.ts`

**Interfaces:**

- Produces `createCanonicalEvidenceRepository(database)` and `assertPersistableEvidence(value)`.
- Consumes `CanonicalReceiptEvidenceV1` and Drizzle transaction API.
- `apps/worker` depends only on the repository interface, never on tables directly.

- [ ] **Step 1: Write failing codec tests before schema implementation**

```ts
expect(() =>
  assertPersistableEvidence({ ...validEvidence, rawSignedTransaction: "0xdeadbeef" }),
).toThrow("sensitive evidence field");
expect(() =>
  assertPersistableEvidence({
    ...validEvidence,
    evidence: [{ provider: "rpc", responseHash: rpcUrlWithCredentials }],
  }),
).toThrow();
```

- [ ] **Step 2: Run the focused database test and verify it fails because repository validation is absent**

Run: `pnpm --filter @mandate/db test -- database.test.ts`

Expected: failure references missing `assertPersistableEvidence`.

- [ ] **Step 3: Define Drizzle tables with canonical unique keys and database constraints**

Add `strategies`, `contract_deployments`, `executions`, `execution_events`, `balance_deltas`, `audits`, `audit_evidence`, and `evidence_invalidations`. Use `numeric(78,0)` for all chain integers, `text` with lowercase-hex check constraints for addresses/hashes, `jsonb` only for strict schema-validated decoded public event payloads, and unique indexes including:

```ts
unique("execution_events_canonical_key").on(
  table.chainId,
  table.blockHash,
  table.txHash,
  table.logIndex,
);
unique("audits_canonical_version_key").on(
  table.chainId,
  table.txHash,
  table.auditVersion,
  table.blockHash,
);
unique("audit_evidence_ordinal_key").on(table.auditId, table.ordinal);
```

Use database `CHECK` constraints for statuses and nonnegative decimal columns. Use `onConflictDoNothing` for append-only strategy/deployment imports; no update path exists for either table.

- [ ] **Step 4: Generate and inspect the migration**

Run: `pnpm --filter @mandate/db db:generate`

Expected: a new Drizzle migration contains only table/index/constraint creation and does not alter `simulation_evidence` semantics.

- [ ] **Step 5: Implement the narrow repository and secret-shaped value rejection**

```ts
export interface CanonicalEvidenceRepository {
  persistCanonicalEvidence(input: CanonicalReceiptEvidenceV1): Promise<void>;
  invalidateReorgedEvidence(input: {
    chainId: string;
    txHash: `0x${string}`;
    replacedBlockHash: `0x${string}`;
    canonicalBlockHash: `0x${string}` | null;
    reason: "BLOCK_HASH_REPLACED" | "RECEIPT_DISAPPEARED";
  }): Promise<void>;
  listPendingConfirmations(input: {
    chainId: string;
    limit: number;
  }): Promise<readonly PendingExecution[]>;
}
```

Reject recursively by field name and string value before opening a transaction. Match case-insensitively on `privateKey`, `mnemonic`, `authorization`, `bearer`, `password`, `apikey`, `rawSignedTransaction`, `signedTransaction`, and credential-bearing URLs. Permit public `0x` calldata/log data only when it is not a signed transaction field.

- [ ] **Step 6: Run schema/codec verification**

Run: `pnpm --filter @mandate/db test && pnpm --filter @mandate/db typecheck && pnpm --filter @mandate/db db:generate`

Expected: tests and typecheck pass; a second generation produces no new migration.

- [ ] **Step 7: Commit schema and codecs**

```bash
git add packages/db/src packages/db/drizzle packages/db/test
git commit -m "feat: model append-only execution evidence"
```

### Task 4: Prove atomic replay and reorg persistence against PostgreSQL

**Files:**

- Create: `packages/db/test/canonical-evidence.integration.test.ts`
- Create: `packages/db/test/support/postgres.ts`
- Modify: `packages/db/package.json`
- Modify: `docker-compose.yml`

**Interfaces:**

- Consumes `CanonicalEvidenceRepository` and the valid canonical-evidence fixture from Task 1.
- Produces a repeatable PostgreSQL test command that starts with an empty test database and applies Drizzle migrations.

- [ ] **Step 1: Write failing replay and atomicity integration tests**

```ts
await repository.persistCanonicalEvidence(evidence);
await repository.persistCanonicalEvidence(evidence);
expect(await countRows("execution_events")).toBe(evidence.events.length);
expect(await countRows("audits")).toBe(1);

await expect(repository.persistCanonicalEvidence(evidenceWithInvalidChild)).rejects.toThrow();
expect(await countRows("executions")).toBe(0);
```

- [ ] **Step 2: Run the integration test against an empty local PostgreSQL database and verify red**

Run: `docker compose up -d postgres && TEST_DATABASE_URL=postgresql://mandate:mandate@127.0.0.1:55432/mandate?sslmode=disable pnpm --filter @mandate/db test -- canonical-evidence.integration.test.ts`

Expected: tests fail because the repository transaction has not been implemented.

- [ ] **Step 3: Implement one atomic transaction**

`persistCanonicalEvidence` must insert execution, receipt logs, deltas, audit, and audit evidence within one `database.transaction(async (tx) => { ... })`. The function must call `assertPersistableEvidence` before the transaction and use the canonical conflict targets for every immutable child table. It must refuse an execution whose status is not `CONFIRMED`.

- [ ] **Step 4: Add a failing reorg invalidation test**

```ts
await repository.persistCanonicalEvidence(evidence);
await repository.invalidateReorgedEvidence({
  chainId: evidence.execution.chainId,
  txHash: evidence.execution.txHash,
  replacedBlockHash: evidence.execution.block.hash,
  canonicalBlockHash: replacementHash,
  reason: "BLOCK_HASH_REPLACED",
});
expect(await executionStatus(evidence.execution.txHash)).toBe("REORGED");
expect(await latestAuditIsInvalidated(evidence.execution.txHash)).toBe(true);
expect(await countRows("evidence_invalidations")).toBe(1);
```

- [ ] **Step 5: Implement explicit reorg invalidation**

In one transaction, update only execution lifecycle fields to `REORGED`, insert exactly one idempotent invalidation row per affected audit, and set `invalidated_at`/reason on matching audit rows. Do not delete or modify events/deltas. A replacement receipt can subsequently persist its own audit key containing the new block hash.

- [ ] **Step 6: Run focused PostgreSQL integration verification twice**

Run twice:

```bash
docker compose down -v && docker compose up -d --wait postgres
DATABASE_MIGRATION_URL=postgresql://mandate:mandate@127.0.0.1:55432/mandate?sslmode=disable pnpm --filter @mandate/db db:migrate
TEST_DATABASE_URL=postgresql://mandate:mandate@127.0.0.1:55432/mandate?sslmode=disable pnpm --filter @mandate/db test -- canonical-evidence.integration.test.ts
```

Expected both runs apply migrations to an empty database and pass replay, atomicity, secret rejection, and reorg cases.

- [ ] **Step 7: Commit PostgreSQL proof**

```bash
git add packages/db/test packages/db/src packages/db/package.json docker-compose.yml
git commit -m "test: prove canonical evidence replay and reorg safety"
```

### Task 5: Implement confirmation and ancestry worker

**Files:**

- Create: `apps/worker/package.json`
- Create: `apps/worker/tsconfig.json`
- Create: `apps/worker/src/index.ts`
- Create: `apps/worker/src/worker.ts`
- Create: `apps/worker/test/worker.test.ts`
- Modify: `pnpm-workspace.yaml`
- Modify: `docs/technical/TECH-STACK.md`
- Modify: `docs/BUILD-PLAN.md`

**Interfaces:**

- Consumes `MandateChainService.readCanonicalEvidence`, a `CanonicalEvidenceRepository`, and environment variables `WORKER_POLL_INTERVAL_MS`, `WORKER_CONFIRMATION_DEPTH`, `WORKER_BATCH_SIZE`.
- Produces `ConfirmationWorker.runOnce(): Promise<WorkerRunResult>` and `startConfirmationWorker()`.

- [ ] **Step 1: Write failing worker tests for confirmation, canonical persistence, and block replacement**

```ts
const result = await worker.runOnce();
expect(result.deferred).toBe(1);
expect(repository.persistCanonicalEvidence).not.toHaveBeenCalled();

chain.canonicalBlockHash.mockResolvedValue(replacementHash);
await worker.runOnce();
expect(repository.invalidateReorgedEvidence).toHaveBeenCalledWith(
  expect.objectContaining({ reason: "BLOCK_HASH_REPLACED" }),
);
```

- [ ] **Step 2: Run focused worker tests and verify red**

Run: `pnpm --filter @mandate/worker test -- worker.test.ts`

Expected: package/script and worker module do not exist.

- [ ] **Step 3: Implement a dependency-injected one-batch worker**

```ts
export class ConfirmationWorker {
  constructor(private readonly dependencies: WorkerDependencies) {}

  async runOnce(): Promise<WorkerRunResult> {
    // For each pending row: canonical hash check, confirmation count refresh,
    // then evidence fetch and atomic repository persistence.
  }
}
```

Require `WORKER_CONFIRMATION_DEPTH` to be a nonnegative integer and `WORKER_POLL_INTERVAL_MS` to be a positive bounded integer. For every mined row, fetch the current canonical block by the stored number before counting confirmations. A missing receipt after observation invalidates with `RECEIPT_DISAPPEARED`; an RPC failure is recorded as a retryable worker error and never persists a compliant audit.

- [ ] **Step 4: Implement minimal process lifecycle**

`src/index.ts` loads the existing root `.env` convention, creates the existing Sepolia viem client/database, logs only structured counters and request/error hashes, schedules `runOnce`, and handles `SIGINT`/`SIGTERM` by stopping future ticks and closing the database. Do not expose HTTP routes.

- [ ] **Step 5: Run worker verification**

Run: `pnpm --filter @mandate/worker test && pnpm --filter @mandate/worker typecheck`

Expected: confirmation, reorg, receipt-disappearance, and RPC-error tests pass.

- [ ] **Step 6: Update Task 8 checklist and document worker environment values**

Mark the completed Task 8 implementation items only after the database and worker proofs pass. Document defaults and safe ranges without introducing credentials into docs.

- [ ] **Step 7: Commit worker lifecycle**

```bash
git add apps/worker packages/db packages/chain docs/technical/TECH-STACK.md docs/BUILD-PLAN.md pnpm-workspace.yaml
git commit -m "feat: reconcile canonical Mandate evidence"
```

### Task 6: Release verification and delivery

**Files:**

- Modify only files needed to correct verification failures from Tasks 1–5.

**Interfaces:**

- Verifies the complete Task 8 persistence contract without changing public API semantics.

- [ ] **Step 1: Run the fresh-PostgreSQL migration and integration proof twice**

Run the exact Task 4 command sequence twice. Record only command outcomes; do not commit database volumes, dumps, logs, or credentials.

- [ ] **Step 2: Run affected workspace checks**

```bash
pnpm --filter @mandate/domain test
pnpm --filter @mandate/chain test
pnpm --filter @mandate/db test
pnpm --filter @mandate/worker test
pnpm --filter @mandate/domain typecheck
pnpm --filter @mandate/chain typecheck
pnpm --filter @mandate/db typecheck
pnpm --filter @mandate/worker typecheck
pnpm lint
pnpm format:check
pnpm docs:verify
pnpm secrets:scan
```

Expected: all commands pass. Fix only failures introduced by Task 8.

- [ ] **Step 3: Inspect the migration and working tree before release commit**

Confirm the generated migration contains no credentials, no destructive drop statements, and no change that mutates append-only strategies/deployments. Confirm ignored Docker data and the user-owned `reference/logo-crop-view.png` are not staged.

- [ ] **Step 4: Commit and push the complete task**

```bash
git add apps/worker packages/domain packages/chain packages/db docs/technical/TECH-STACK.md docs/BUILD-PLAN.md pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "feat: persist canonical Mandate execution evidence"
git push origin dev
```

## Plan Self-Review

- **Spec coverage:** Tasks 1–4 cover ERD constraints/codecs, replay, reorg invalidation, atomic persistence, and redaction. Task 5 covers confirmation depth plus ancestry. Task 6 proves fresh migrations twice and pushes the completed work.
- **No placeholders:** Every task names files, contracts, test commands, expected outcomes, and commit boundaries.
- **Type consistency:** `CanonicalReceiptEvidenceV1` is produced by `MandateChainService.readCanonicalEvidence`, accepted by `CanonicalEvidenceRepository.persistCanonicalEvidence`, and consumed by `ConfirmationWorker`.
- **Scope control:** No Edge Function, Redis queue, generic chain indexer, signing capability, or public route is introduced.
