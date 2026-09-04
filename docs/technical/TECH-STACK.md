# Mandate Technology Stack

## 1. Decision summary

| Layer | Choice | Why |
|---|---|---|
| Workspace | pnpm workspaces + Turborepo | one typed build graph without custom tooling |
| Web | Next.js App Router + React + TypeScript | issuance, public inspection, receipt routes, wallet client islands |
| UI | Tailwind CSS + Radix primitives | accessible behavior with owned visual system |
| Motion | CSS first; Motion for state/layout | sufficient for ledger transitions; reduced-motion support |
| Wallet/RPC | viem + wagmi | typed calldata, block-tagged reads, simulation, wallet state |
| API | Hono on Node | small versioned boundary for agent and Bazantic clients |
| Validation | Zod + generated JSON Schema/OpenAPI | one trust-boundary schema per contract |
| Database | PostgreSQL + Drizzle | relational receipt/evidence provenance and migrations |
| Contracts | Solidity 0.8.30 + Foundry | matches current Aqua compiler and supports focused unit/fork tests |
| Contract libraries | pinned 1inch Aqua source + OpenZeppelin-compatible utilities | reuse audited primitives; no copied partial interfaces without source pin |
| Agent signer | viem local account in isolated server process | direct dedicated EOA without owner-key custody |
| Agent interface | HTTP plus optional MCP tool set | typed simulation/inspection/execution preparation |
| Paid audit | Bazantic x402/MPP Gateway + Recipe | meaningful machine-paid receipt analysis |
| Observability | structured JSON logs + OpenTelemetry-compatible spans | trace simulation/receipt paths without secrets |
| Tests | Foundry, Vitest, Playwright | contract invariants, typed services, real browser flow |

Pin exact versions and integrity in lockfiles at scaffold time. Reverify Aqua and ENSv2 interface compatibility before selecting package revisions.

## 2. Repository layout

```text
mandate/
├─ apps/
│  ├─ web/                    # Next.js UI
│  ├─ api/                    # Hono HTTP + Bazantic service
│  ├─ agent/                  # optional dedicated signer demo runtime
│  └─ worker/                 # confirmations and reorg reconciliation
├─ packages/
│  ├─ domain/                 # schemas, IDs, reason codes, response contracts
│  ├─ policy/                 # pure preflight mirror and explanation
│  ├─ chain/                  # viem clients, reads, simulation, receipt decode
│  ├─ contracts/              # generated ABIs and deployment manifests
│  └─ db/                     # Drizzle schema/migrations/repositories
├─ contracts/
│  ├─ src/MandateAquaApp.sol
│  ├─ script/Deploy.s.sol
│  └─ test/                   # unit, invariant, integration, fork tests
├─ evals/                     # fixed agent prompts and security rubric
├─ skill/SKILL.md             # public agent operating contract
├─ docs/
└─ .agents/skills/            # project execution skills
```

No generic `utils` package. Each invariant belongs to the domain that owns it.

## 3. Runtime baseline

- Node.js active LTS, minimum 22; pin exact version.
- pnpm through Corepack; exact `packageManager` value.
- Solidity/Foundry compiler 0.8.30 for Aqua source compatibility.
- PostgreSQL 16 or newer.
- Docker only for local PostgreSQL.
- Sepolia RPC with archival/block-tagged read support for the demo window.
- A supported-chain archival RPC for the pinned settlement fork if needed.

## 4. Domain types

```ts
export type Address = `0x${string}`;
export type Hex32 = `0x${string}`;
export type DecimalString = `${bigint}`;

export type CheckResult = "PASS" | "FAIL" | "UNKNOWN";

export interface SimulationBindingV1 {
  chainId: DecimalString;
  blockNumber: DecimalString;
  blockHash: Hex32;
  caller: Address;
  to: Address;
  calldataHash: Hex32;
  strategyHash: Hex32;
  expiresAt: string;
}
```

Runtime schemas additionally enforce 20-byte addresses, 32-byte hashes, uint bounds, and checksums where needed. No JavaScript `number` for token amounts, block numbers, timestamps from chain, rate numerator/denominator, or cap usage. JSON and PostgreSQL boundaries use decimal strings.

## 5. Contract dependencies

### Aqua

Use the official interface/source at a pinned git revision. Prefer a git submodule or Foundry dependency pin over copied snippets. Required symbols:

- `IAqua.ship`, `dock`, `rawBalances`, `safeBalances`, `pull`, `push`;
- `AquaApp.nonReentrantStrategy` and its safe callback pattern where applicable.

Mandate's direct venue flow may use a strategy-scoped guard adapted from AquaApp plus explicit post-call balance checks. Any deviation from current `AquaApp` must be justified in contract tests.

### ENSv2

Import the current official interfaces for:

- Permissioned Registry `getStatus`, `getExpiry`, `getTokenId`, `ownerOf`;
- Permissioned Resolver `addr(bytes32)`;
- optional EAC role inspection for the owner UI, not as an invented execution role.

Do not re-create a guessed ABI from prose. Generate viem types from pinned ABIs.

### ERC-20

Use SafeERC20 semantics and `forceApprove` where supported by the selected library. Admission tests reject rebasing/fee-on-transfer tokens for MVP unless exact residue/accounting behavior is modeled.

## 6. Web and server rules

- Server Components handle public inspection and receipt rendering where possible.
- Wallet hooks and transaction lifecycle live in small client components.
- API controllers validate and delegate; no policy arithmetic or ABI encoding in route files.
- Agent signer module exposes only `signAndSendMandateExecution(request)`; it does not expose a raw private key or arbitrary `sendTransaction`.
- Browser never receives agent/server secret or owner private key.
- Shared schemas generate OpenAPI, JSON Schema, and MCP tool definitions.

## 7. Package interfaces

### `@mandate/domain`

Owns `StrategyV1`, `MandateSnapshotV1`, `SimulationV1`, `ExecutionAuditV1`, IDs, and reason codes. No I/O.

### `@mandate/policy`

```ts
export function evaluatePreflight(input: PreflightInputV1): PolicyEvaluationV1;
export function minimumOutput(amountIn: bigint, numerator: bigint, denominator: bigint): bigint;
export function explainCheck(check: PolicyCheckV1): string;
```

It mirrors contract rules for explanation. Contract results remain authoritative.

### `@mandate/chain`

```ts
export interface MandateReader {
  readSnapshot(input: ReadMandateInput): Promise<MandateSnapshotV1>;
  simulate(input: SimulateExecutionInputV1): Promise<SimulationV1>;
  auditReceipt(input: AuditReceiptInputV1): Promise<ExecutionAuditV1>;
}
```

All reads accept explicit chain and optional block reference. No hidden latest-block mix across one response.

### `@mandate/db`

Repositories return domain values, not raw Drizzle rows. Canonical receipt, events, snapshots, and audit result commit atomically. Reorg invalidation is an explicit transaction.

## 8. API contracts

Versioned routes:

- `GET /v1/mandates/{chainId}/{strategyHash}`
- `POST /v1/simulations`
- `GET /v1/executions/{chainId}/{txHash}`
- `GET /v1/receipts/{chainId}/{txHash}/audit`

No generic proxy route, raw RPC route, or arbitrary contract call endpoint. Bazantic calls the audit route through its configured paid service.

## 9. Testing stack

| Contract | Tool | Required examples |
|---|---|---|
| strategy validation/hash | Foundry | invalid fields, encoding parity, Aqua hash equality |
| authority | Foundry | caller, active/revoked, time, ENS status/owner/expiry/address |
| limits/rate | Foundry + fuzz | zero, boundaries, ceil division, cumulative cap, overflow |
| settlement | Foundry | exact pull/call/push, rollback, residue, allowance clearing |
| adversarial tokens/target | Foundry | false return, fee, reentrancy, malicious recipient, partial spend |
| chain adapters | Vitest + Anvil | block binding, revert decode, stale simulation |
| persistence | Vitest + PostgreSQL | idempotency, canonicality, reorg invalidation |
| web | Playwright + real local chain | issue, inspect, simulate pass/fail, execute, revoke, wallet reject, 375px |
| sponsor proof | Sepolia/fork smoke scripts | actual contracts, transaction hashes, balance evidence |

## 10. Rejected choices

| Rejected | Reason |
|---|---|
| Account abstraction for MVP | duplicates mandate policy and increases setup/security surface |
| Relayer for MVP | changes caller/replay model before direct authority is proven |
| NestJS/GraphQL | unnecessary framework/schema weight for four routes |
| Redis/queue service | PostgreSQL jobs and event cadence are enough at hackathon scale |
| General arbitrary-call executor | destroys the narrow authority claim |
| Upgradeable Mandate contract | admin key becomes a hidden mutable policy path |
| Onchain oracle dependency | fixed immutable rate floor proves the boundary without oracle/liveness risk |
| LLM policy evaluator | nondeterministic and unauthoritative |
| GSAP runtime by default | CSS/Motion covers required state transitions |
| Multi-chain abstraction | ENS sponsor proof and Aqua deployment reality must be proven one chain at a time |
