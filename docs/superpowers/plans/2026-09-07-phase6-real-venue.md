# Phase 6 Real Venue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use test-driven-development and verification-before-completion task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admit one exact 1inch Classic Swap route and prove the production Mandate/Aqua settlement path against real Ethereum mainnet router code and liquidity on a pinned fork.

**Architecture:** A narrow `packages/chain/src/route.ts` boundary constructs the v6.1 request, validates the complete response, decodes only explicitly supported router selectors, and emits a secret-free route record. A Foundry fork test runs the existing production `MandateAquaApp` with all ENS, Aqua, policy, balance, residue, and allowance checks enabled. `packages/contracts/src/deployments/mainnet.json` and `docs/evidence/settlement.md` bind the proof to one canonical block, runtime code hashes, sanitized request evidence, and observed deltas.

**Tech Stack:** TypeScript 5.9, Zod 4.5, viem 2.56, Vitest 5, Solidity 0.8.30, Foundry 1.8.1, 1inch Classic Swap API v6.1, Ethereum mainnet fork.

**Spec:** `docs/BUILD-PLAN.md` Task 6 and `docs/technical/SMART-CONTRACT.md`.

## Global Constraints

- Preserve `MandateAquaApp` authorization: one configured agent signs execution; public demo access never means arbitrary callers can execute another agent's mandate.
- Admit only chain ID `1`, ERC-20 input/output, zero native value, exact input, app recipient, app caller, canonical verified target, supported decoded selector, and no partial-fill flag.
- The route may not select an arbitrary target, agent recipient, callback custody, persistent approval, or successful input residue.
- The fork test must deploy/use the exact production app and exercise its live ENS, Aqua, rate, cap, selector, pull, route, output-delta, push, residue, and allowance guards.
- Keep secrets out of source, manifests, fixtures, docs, logs, and commits. Persist only endpoint path/parameters, response request ID, calldata hash or explicitly reviewed calldata, block references, addresses, code hashes, and observed outcomes.
- Label Sepolia identity and mainnet-fork settlement as separate proofs; never imply cross-chain atomicity.
- Do not modify frontend or add Privy/account abstraction in Phase 6.

---

### Task 1: Route admission boundary

**Files:**

- Create: `packages/chain/src/route.ts`
- Modify: `packages/chain/package.json`
- Create: `packages/chain/test/route.test.ts`

**Interfaces:**

- Consumes: 1inch Classic Swap v6.1 response fields and a fixed expected request context.
- Produces: `buildClassicSwapRequest`, `admitClassicSwapRoute`, `requestClassicSwapRoute`, and serialized route evidence used by the capture script and manifest.

- [ ] Write tests with hand-checked complete API fixtures proving the exact query, canonical addresses, zero value, exact amount, app recipient, supported selector decoding, and partial-fill rejection.
- [ ] Run the focused Vitest file and observe failures because `route.ts` does not exist.
- [ ] Implement the minimum validated request/admission functions and supported router ABI.
- [ ] Run the focused tests until green; typecheck and lint `@mandate/chain`.
- [ ] Commit the route boundary and tests.

### Task 2: Machine-readable venue evidence

**Files:**

- Modify: `packages/domain/src/index.ts`
- Modify: `packages/domain/test/domain.test.ts`
- Create: `packages/contracts/src/deployments/mainnet.json`
- Create: `packages/chain/scripts/capture-route.ts`
- Modify: `packages/chain/package.json`

**Interfaces:**

- Consumes: admitted route evidence, canonical block header, and runtime code fetched through the configured mainnet RPC.
- Produces: a strict `VenueManifestV1Schema` and one checked-in secret-free mainnet proof manifest.

- [ ] Write failing schema tests covering complete evidence and rejection of nonzero value, partial fill, wrong recipient, wrong chain, missing code hash, and inconsistent token/contract chain IDs.
- [ ] Implement the smallest strict schema and export its inferred type/JSON schema.
- [ ] Write the capture script to request a route, pin a canonical block, verify runtime code/code hashes, and atomically write sanitized evidence without secrets.
- [ ] Validate the checked-in mainnet manifest through the domain test suite.
- [ ] Commit schema, capture script, and manifest.

### Task 3: Production fork settlement proof

**Files:**

- Create: `contracts/test/MandateAquaApp.fork.t.sol`
- Use: `packages/contracts/src/deployments/mainnet.json`

**Interfaces:**

- Consumes: pinned block, canonical Aqua/router/token addresses, decoded selector, reviewed route calldata, expected output floor, and a maker address with real token balance at the pinned block.
- Produces: deterministic proof of exact production settlement and rollback/rejection invariants.

- [ ] Write a fork test that fails before its fixture/manifest path is implemented.
- [ ] Fork the exact manifest block; assert chain ID, block hash, router/Aqua code hashes, and token metadata.
- [ ] Deploy the exact production `MandateAquaApp`; configure an ENS-compatible identity without bypassing any production execution check; ship and activate the real strategy through Aqua.
- [ ] Execute the admitted route from the configured agent and assert exact maker/app/agent physical deltas, Aqua virtual deltas, zero app residue, zero final allowances, used-input accounting, and correlated Mandate/Aqua/ERC-20 events.
- [ ] Add rejection checks for one mutated recipient/partial-spend or target condition when the mutation exercises a consumer-visible production guard rather than router internals.
- [ ] Run the focused fork test against `SETTLEMENT_FORK_RPC_URL`, then the full Foundry suite.
- [ ] Commit the fork proof.

### Task 4: Evidence, checklist, and final verification

**Files:**

- Create: `docs/evidence/settlement.md`
- Modify: `docs/BUILD-PLAN.md`

**Interfaces:**

- Consumes: final route manifest and passing fork output.
- Produces: sponsor-readable proof with exact commands, block/address/hash/request metadata, deltas, limitations, and explorer links.

- [ ] Record the admitted target, selector/schema, caller, recipient, amount, minimum output, deadline/flags, request ID, block/hash, code hashes, and test-observed deltas.
- [ ] State explicitly that Sepolia proves ENSv2 identity while mainnet fork proves real liquidity, with no cross-chain atomicity claim.
- [ ] Run chain/domain/contracts focused checks, full `forge test`, root `pnpm verify`, and the live capture/runtime probe.
- [ ] Mark only evidenced Task 6 checkboxes complete.
- [ ] Run secret scan and inspect final Git scope; exclude `.env`, Graphify output, broadcast/cache/out, and unrelated user files.
- [ ] Commit with `feat: admit one verified Mandate settlement route` and push `dev`.
