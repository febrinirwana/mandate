# Canonical Evidence Persistence Design

**Goal:** Persist Mandate execution evidence as an append-only PostgreSQL audit model that is idempotent under replay and explicitly invalidated under a chain reorganization.

## Scope

Task 8 implements durable canonical receipt evidence only. It does not add Supabase Edge Functions, queues, a generic event indexer, signing, or new public API routes. The existing Hono API remains responsible for read/simulation/audit requests; a Node worker owns confirmation and canonicality refresh.

## Authority model

The chain remains authoritative. PostgreSQL stores a versioned read/audit projection:

- A database outage can make evidence unavailable but cannot make `FAIL` or `UNKNOWN` become `PASS` or `COMPLIANT`.
- A canonical receipt audit is immutable for its `(execution, audit version, block hash)` context.
- A reorganization creates an invalidation record; it never overwrites or deletes prior evidence.
- Strategies and deployment provenance are append-only. A changed strategy is a distinct strategy hash.

## Data model

`@mandate/db` extends the existing `simulation_evidence` table with:

- `executions`: one observed transaction per `(chain_id, tx_hash)`; mutable lifecycle fields are limited to confirmation status and derived confirmation count. It records strategy identity, sender, event amounts, canonical block reference, and transaction index.
- `execution_events`: one decoded/raw receipt log per `(chain_id, block_hash, tx_hash, log_index)`. Raw topics/data are public-chain evidence; decoded payload is versioned and validated.
- `balance_deltas`: immutable before/after observations for maker, agent, and Mandate app token balances. Its uniqueness key binds the execution, account, token, source, and observed block references.
- `audits`: one immutable audit version per `(chain_id, tx_hash, audit_version, block_hash)`, with `COMPLIANT`, `NON_COMPLIANT`, or `UNKNOWN` result.
- `audit_evidence`: evidence rows keyed by audit and stable evidence ordinal, with source, provider, exact block reference, contract/method/event, response hash, and optional public URI.
- `evidence_invalidations`: append-only records that bind superseded block hash, replacement block hash when known, invalidation reason, and timestamp.

All addresses and hashes are lowercase validated hex strings at the TypeScript/PostgreSQL boundary. Amounts and blocks use `numeric(78,0)` and enter/leave repositories as decimal strings. No JavaScript `number` represents a chain integer.

## Repository interface

`@mandate/db` exports one narrow repository constructor:

```ts
export interface CanonicalEvidenceRepository {
  persistCanonicalEvidence(input: PersistCanonicalEvidenceInput): Promise<void>;
  invalidateReorgedEvidence(input: ReorgInvalidationInput): Promise<void>;
  listPendingConfirmations(input: PendingConfirmationQuery): Promise<PendingExecution[]>;
}
```

`persistCanonicalEvidence` validates and commits execution state, receipt events, balance deltas, audit result, and audit evidence in one database transaction. Its conflict targets are canonical evidence keys, so a replay of the same receipt is a no-op. It rejects noncanonical/reorged input and sensitive field names/values before the transaction begins.

`invalidateReorgedEvidence` transactionally marks the affected execution `REORGED`, records an invalidation row for every affected audit, and does not delete receipt evidence. A later canonical receipt is persisted as independent evidence with its own block hash.

## Confirmation worker

`apps/worker` is one small Node process, not an Edge Function. It periodically selects submitted or insufficiently-confirmed execution rows, then for each row:

1. Reads the receipt and explicit block reference from `@mandate/chain`.
2. Reads the canonical block at the recorded block number and compares hashes.
3. If the hash differs or the receipt is absent after it was observed, records reorg invalidation.
4. If canonical but below configured confirmation depth, updates only derived confirmation count.
5. If canonical and confirmed, calls the existing block-bound receipt audit and persists its entire evidence bundle atomically.

The worker has no wallet, private key, raw-signing API, or generic RPC proxy. PostgreSQL polling is sufficient at the stated hackathon scale; Redis and Supabase Edge Functions add no required capability.

## Reorg and replay behavior

- Reprocessing one canonical receipt must preserve exactly one execution-event row for each receipt log and one audit-evidence row for each audit ordinal.
- The block-hash check is the canonicality boundary. Transaction hash alone is not enough.
- A replaced hash invalidates prior audit results immediately. Consumers must not receive a compliant result from invalidated evidence.
- New evidence for a replacement receipt always carries the replacement block hash; old evidence remains queryable only as invalidated history.

## Retention and redaction

Persist public chain logs, validated decoded event payloads, normalized audit values, hashes, and public URIs only. Reject values or keys that contain private keys, mnemonics, bearer tokens, Supabase credentials, RPC URLs with credentials, signed raw transactions, or route authorization headers. Logs store request IDs and hashes rather than secret-bearing payloads.

## Tests and proof

Focused Vitest/PostgreSQL integration tests prove:

1. decimal codec and check constraints reject invalid hashes, unsafe numeric values, and invalid evidence result values;
2. persisting the same canonical receipt twice produces no duplicate execution events, deltas, audits, or evidence;
3. replacement of a stored block hash invalidates the prior execution/audit without deleting its history, then permits independent replacement canonical evidence;
4. receipt/event/delta/audit insertion is atomic by forcing a child-row failure and observing no parent execution evidence;
5. secret-shaped keys and values are rejected before persistence;
6. migrations apply to an empty PostgreSQL database twice without error, then the integration suite passes.

The final verification runs against the fresh local PostgreSQL container twice and retains the Supabase migration history as the reviewed production path.
