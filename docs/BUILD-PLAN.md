# Mandate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `subagent-driven-development` or `executing-plans` task-by-task. Each checklist item is independently verifiable; do not parallelize tasks that modify the shared contract/schema interfaces.

**Goal:** Build and demonstrate one ENSv2-bound dedicated agent executing one immutable, capped Aqua token-conversion strategy while the treasury owner retains custody between transactions.  
**Architecture:** A non-upgradeable Solidity app enforces identity, route, rate, amount, time, and revocation constraints around Aqua pull/push settlement. TypeScript services mirror checks for simulation and audit; Next.js presents issuance/inspection; Bazantic sells a receipt audit Recipe combining Mandate and 1inch evidence.  
**Tech stack:** Solidity 0.8.30, Foundry, pnpm/Turborepo, TypeScript, Next.js, Hono, viem/wagmi, PostgreSQL/Drizzle, Bazantic x402/MPP.  
**Spec:** [PRD](./PRD.md)  
**Technical contracts:** [Architecture](./technical/ARCHITECTURE.md), [Smart Contract](./technical/SMART-CONTRACT.md), [ERD](./technical/ERD.md), [Integrations](./technical/INTEGRATIONS.md)

## Global constraints

- Event work begins after ETHOnline kickoff; preserve public commit history.
- One maker, one dedicated agent EOA, one live ENSv2 identity, one token pair, one venue target/selector, one immutable strategy.
- Owner key never enters code, server, test fixture, environment, or logs.
- Agent holds gas only and cannot call arbitrary destinations through project interfaces.
- Output recipient is always maker; successful app balances and allowances return to baseline.
- All token amounts/rates/blocks are exact integers; JSON uses decimal strings.
- Simulation is advisory; execution repeats every check onchain.
- Missing deployment/ENS/RPC/receipt evidence fails closed.
- Signed-intent relaying, smart-account sessions, multiple strategies, and dynamic policy edits are excluded.

## Target file map

```text
apps/web                       product UI and wallet handoff
apps/api                       HTTP, simulation, inspection, Bazantic audit service
apps/agent                     isolated dedicated signer runtime
apps/worker                    receipt confirmation/reorg audit jobs
packages/domain                canonical Zod/types/reason codes
packages/policy                pure preflight mirror and explanation
packages/chain                 viem reads/calldata/simulation/receipt decode
packages/contracts             generated ABIs and deployment manifests
packages/db                    Drizzle schema/migrations/repositories
contracts/src                  MandateAquaApp
contracts/test                 unit, fuzz, invariant, integration, fork tests
contracts/script               deterministic deployment/setup scripts
evals                          fixed prompts and security rubric
skill/SKILL.md                 public safe agent workflow
docs                           product and technical specifications
```

---

## Task 1: Pin kickoff evidence and scaffold typed workspace

**Files:** create root workspace/config files; `packages/domain`; `packages/contracts/src/deployments`; `contracts/foundry.toml`; `.env.example`; `docker-compose.yml`; `docs/evidence/kickoff.md`.

**Produces:** exact tool/dependency versions, shared domain schema, deployment manifest schema, and recorded sponsor/deployment evidence.

- [x] At kickoff, capture current ETHOnline 1inch/ENS/Bazantic requirements with official URLs and timestamps; separate requirements from interpretation.
- [x] Pin Node, pnpm, Solidity 0.8.30, Foundry dependencies, Aqua revision, ENSv2 contracts revision, and selected OpenZeppelin/1inch utility revisions.
- [x] Probe official Aqua and ENSv2 deployments with `eth_chainId`, `eth_getCode`, runtime code hash, and one interface read; record official versus self-deployed status.
- [x] Scaffold only directories in the target map; configure strict TypeScript, lint, format, test, typecheck, docs verification, and secret scanning scripts.
- [x] Define Zod schemas for address/hash/decimal-string/block ref, `StrategyV1`, simulation binding/checks, mandate snapshot, receipt audit, and deployment manifest.
- [x] Define the stable reason-code union exactly as the PRD; generate JSON Schema/OpenAPI inputs rather than maintaining copies.
- [x] Write tests rejecting floating amounts, malformed addresses/hashes, unknown fields/codes, zero denominators, inconsistent caps/windows, and incomplete deployment evidence.
- [x] Run `pnpm --filter @mandate/domain test` and `pnpm --filter @mandate/domain typecheck`.
- [x] Commit `chore: pin Mandate kickoff evidence and domain contracts`.

Acceptance: a valid strategy/manifest round-trips through JSON with no bigint loss; every enabled external contract has chain, address, code hash, source revision, and verification block.

## Task 2: Specify contract behavior with failing Foundry tests

**Files:** create `contracts/test/MandateAquaApp.t.sol`, `MandateAquaApp.fuzz.t.sol`, `MandateAquaApp.invariant.t.sol`, and adversarial fixtures under `contracts/test/fixtures`.

**Consumes:** exact pinned Aqua/ENS interfaces and Strategy layout from Task 1.  
**Produces:** executable contract acceptance suite before implementation.

- [x] Build a real pinned Aqua local fixture from sponsor source, not a hand-written approximation.
- [x] Implement only minimal ENS registry/resolver and venue/token adversarial fixtures required to drive boundary behavior; fixture names must say `Mock` or `Test`.
- [x] Write failing activation tests: maker-only, valid fields, duration, duplicate hash, both Aqua tokens active, exact Aqua/local hash equality.
- [x] Write failing identity tests: wrong caller, unregistered, expired, stale token ID handling, owner mismatch, resolver mismatch, read revert.
- [x] Write failing policy tests for time edges, zero amount, exact per-call/total boundaries, cumulative breach, rate ceiling division, selector mismatch, and expired execution deadline.
- [x] Write failing settlement tests for exact pull, exact target approval, full input spend, output delta, output push, allowance clearing, event fields, and baseline-safe direct dust.
- [x] Write rollback tests for route revert, short output, partial spend, false/fee/reentrant token, malicious target, and failed Aqua push.
- [x] Write stateful invariants: used never exceeds total, revoked never reactivates, failed call changes no state/balance, successful output reaches maker only, attributable app balances/allowances return to baseline.
- [x] Run focused tests and record expected failures because `MandateAquaApp` is absent.
- [x] Commit `test: define Mandate authority and settlement invariants`.

Acceptance: tests fail for missing production contract rather than fixture/setup errors, and each PRD contract invariant has a named test.

## Task 3: Implement the minimal MandateAquaApp

**Files:** create `contracts/src/MandateAquaApp.sol` and update Foundry tests.

**Interface:** exact `Strategy`, `MandateState`, `strategyHash`, `minimumOutput`, `activate`, `revoke`, `inspect`, and `execute` from SMART-CONTRACT.

- [x] Implement constructor immutables and shared strategy validation with custom errors.
- [x] Implement exact ABI strategy hashing and activation against Aqua `safeBalances`.
- [x] Implement current-token ENS status/expiry/owner/resolver checks from pinned official interfaces.
- [x] Implement owner-only irreversible revoke.
- [x] Implement full-precision ceiling rate calculation.
- [x] Implement globally or strategy-scoped non-reentrancy according to the simplest passing threat model.
- [x] Implement execution in specified order: checks, reserve usage, Aqua pull, exact target approval/call/reset, baseline/delta checks, rate checks, exact Aqua approval/push/reset, residual checks, event.
- [x] Preserve bounded external revert evidence without trusting arbitrary revert strings.
- [x] Make all Task 2 unit/fuzz/invariant tests pass; run `forge fmt --check`, `forge build`, `forge test`, and gas snapshot.
- [x] Review storage packing only after correctness; do not change public encoding for cosmetic gas savings.
- [x] Commit `feat: enforce identity-bound Aqua mandates`.

Acceptance: all adversarial paths roll back atomically; no test-only branch, admin bypass, arbitrary target/recipient, or upgrade hook exists.

## Task 4: Prove local Aqua settlement and deployment reproducibility

**Files:** create `contracts/script/DeployLocal.s.sol`, `SetupLocalStrategy.s.sol`, `contracts/test/MandateAquaApp.integration.t.sol`; generate ABI artifacts into `packages/contracts`.

- [x] Deploy pinned Aqua, standard test tokens, exact-input test venue, and Mandate to a clean Anvil state.
- [x] Create owner and dedicated agent accounts; fund agent with gas only; assert agent has zero strategy tokens.
- [x] Owner approves Aqua, ships both strategy tokens with output allocation zero, and activates exact hash.
- [x] Simulate then execute one conversion and capture physical balances, Aqua raw balances, allowances, and events before/after.
- [x] Execute wrong signer, cap breach, poor-output, and revoke-then-repeat scenarios.
- [x] Restart from clean Anvil and prove deployment addresses/hashes are reproducible under the selected method.
- [x] Generate TypeScript ABI types from the built artifact and compare Strategy tuple layout/hash in Solidity and viem.
- [x] Commit `test: prove atomic Aqua mandate settlement`.

Acceptance: one command starts clean chain, deploys, ships, activates, executes, revokes, and asserts all deltas; fixture venue is visibly labeled local-only.

## Task 5: Integrate real ENSv2 on Sepolia

**Files:** create `packages/chain/src/ens.ts`, `contracts/script/DeploySepolia.s.sol`, `SetupEnsIdentity.s.sol`, `packages/contracts/src/deployments/sepolia.json`, and ENS integration tests/scripts.

- [x] Compile against official ENSv2 interfaces and replace any documentation-only guessed types.
- [ ] Record official Sepolia registry/resolver addresses and code hashes at a verified block.
- [ ] Register/select the owner-controlled parent/subregistry and finite-expiry agent subname through the sponsor-recommended flow.
- [ ] Bind current token owner and resolver address to the dedicated agent; read all identity fields at one block and validate domain schema.
- [ ] Deploy compatible Aqua source if no official Sepolia Aqua exists, marking `official: false`; deploy Mandate with verified constructor args.
- [ ] Ship/activate a small strategy and execute a bounded identity-gated state change/settlement supported by the environment.
- [ ] Change one ENS authority dimension through the owner-controlled stop path and prove identical agent execution reverts.
- [ ] Record transactions, blocks, code hashes, and explorer links; no faucet key or RPC secret in artifacts.
- [ ] Commit `feat: bind Mandate execution to ENSv2 Sepolia identity`.

Acceptance: public Sepolia evidence proves active identity permits and owner-controlled identity change denies; UI/API reads match contract state at cited blocks.

## Task 6: Admit and prove one real settlement venue

**Files:** create `packages/contracts/src/deployments/<chain>.json`, `packages/chain/src/route.ts`, `contracts/test/MandateAquaApp.fork.t.sol`, and `docs/evidence/settlement.md`.

- [ ] Request a live route/quote for the fixed pair using current 1inch or verified venue API; record destination, selector, calldata schema, recipient, amount, deadline, and response/request ID.
- [ ] Verify target bytecode/source and exact-input full-spend semantics at a pinned block.
- [ ] Reject routes that require arbitrary target, agent-selected recipient, native value, partial input residue, callback custody, or approval persistence.
- [ ] Run the exact production Mandate app on testnet or pinned fork; do not replace it with a harness that skips ENS/Aqua/policy checks.
- [ ] Prove actual maker/app/agent physical balance deltas, Aqua virtual deltas, allowance reset, and event correlation.
- [ ] If no real route works on Sepolia, document the dual proof without implying cross-chain atomicity: Sepolia identity proof plus supported-chain pinned fork settlement.
- [ ] Commit `feat: admit one verified Mandate settlement route`.

Acceptance: venue manifest passes schema and runtime probe; successful proof uses real venue code/liquidity, while fixtures remain separately labeled.

## Task 7: Implement shared preflight, simulation, and receipt audit

**Files:** create `packages/policy`, `packages/chain`, `apps/api`, and focused tests.

- [ ] Write failing pure tests mapping every contract check/error to stable `PASS/FAIL/UNKNOWN` reasons and ceiling-rate math parity.
- [ ] Implement block-consistent Mandate, Aqua, ENS, token, and deployment reads.
- [ ] Implement exact calldata construction and `eth_call` from actual agent; bind response to chain/block/hash/caller/to/calldata/strategy/expiry.
- [ ] Make stale detection event/block driven and reject a changed request against old simulation ID.
- [ ] Implement receipt audit from canonical receipt, Mandate/Aqua/ERC-20 events, strategy bytes/hash, execution-block identity, and physical/virtual deltas.
- [ ] Return `UNKNOWN` for missing archival reads, reorg, undecodable event, unavailable ENS state, or external trace failure.
- [ ] Expose four versioned routes from TECH-STACK with OpenAPI generated from Zod.
- [ ] Add request limits, bounded timeouts, structured request IDs, and secret/redaction tests.
- [ ] Run API/policy/chain tests against clean local Anvil and the recorded Sepolia/fork manifests.
- [ ] Commit `feat: add deterministic Mandate simulation and audit API`.

Acceptance: web, agent, and Bazantic clients can consume one response schema; API cannot sign or turn a failed/unknown check into pass.

## Task 8: Persist canonical evidence and survive reorg/replay

**Files:** create `packages/db`, migrations, `apps/worker`, and PostgreSQL integration tests.

- [ ] Implement ERD constraints and decimal-string/binary codecs; keep strategies/deployments append-only.
- [ ] Write replay test: same receipt/events produce no duplicates.
- [ ] Write reorg test: block hash replacement marks old execution/audit invalid and creates new canonical evidence.
- [ ] Implement confirmation worker using configured depth and block-hash ancestry checks.
- [ ] Commit receipt, events, deltas, and audit atomically; never expose partially updated compliant receipt.
- [ ] Implement retention/redaction checks that reject secret-shaped fields and raw private/signed payloads.
- [ ] Run migrations and integration tests against a fresh PostgreSQL container twice.
- [ ] Commit `feat: persist canonical Mandate execution evidence`.

Acceptance: database deletion permits chain reconstruction; replay is idempotent; reorg cannot leave a green stale audit.

## Task 9: Build issuance, inspection, simulation, and receipt UI

**Files:** create `apps/web` routes/components/styles/tests according to DESIGN-SYSTEMS.

- [ ] Build read-only landing and mandate inspection first; no wallet required.
- [ ] Build four-step owner issuance with exact field validation, human summary, ABI table, transaction sequence, and receipt states.
- [ ] Build authority header, constraint ledger, Aqua physical/virtual distinction, simulation gate, flow trace, revocation console, and receipt plate.
- [ ] Integrate wallet signing for ENS setup, token approvals, Aqua ship/dock, Mandate activation/revoke; preserve state on rejection.
- [ ] Integrate agent/manual execution path without exposing server signer secrets.
- [ ] Implement loading, stale, RPC outage, ENS mismatch, route revert, wallet rejection, submitted, confirmed, reverted, and reorged states.
- [ ] Meet WCAG 2.2 AA, keyboard/focus, full accessible addresses, 44px targets, reduced motion, and 375px layout.
- [ ] Use CSS/Motion only; add GSAP only with a recorded need and performance check.
- [ ] Drive the actual local surface with Playwright through issue, inspect, simulate pass, simulate fail, execute, receipt, revoke, repeated fail, wallet reject, and narrow viewport.
- [ ] Commit `feat: ship Mandate authority ledger experience`.

Acceptance: a new viewer can state who may act, what can move, remaining cap, expiry, and revoke path in ten seconds; browser proof covers real local chain behavior.

## Task 10: Add isolated agent runtime and public skill

**Files:** create `apps/agent`, `skill/SKILL.md`, `evals`, and tests.

- [ ] Define signer interface that accepts only validated Mandate execution requests; no generic transaction/sign message method.
- [ ] Load encrypted dedicated keystore in server-only process; assert chain/app/strategy/selector/amount policy before signing.
- [ ] Implement flow: inspect -> simulate -> require fresh pass -> sign/send -> wait receipt -> audit.
- [ ] Add manual mode using a dedicated browser wallet for environments where automated key custody is inappropriate.
- [ ] Write public skill with exact safety rules, tool schemas, reason semantics, and examples; no credentials or hard-coded demo success.
- [ ] Evaluate fixed prompts against an unconstrained raw signer baseline: wrong target, cap breach, stale simulation, revoked identity, malicious route, unknown evidence.
- [ ] Record whether Mandate prevents prohibited submissions and where onchain reverts remain the final boundary.
- [ ] Commit `feat: constrain dedicated Mandate agent signer`.

Acceptance: compromised decision logic cannot ask project signer to submit an arbitrary transaction; onchain contract still rejects bypass attempts sent outside the runtime.

## Task 11: Publish Bazantic paid audit Recipe

**Files:** update `apps/api` audit service; create `integrations/bazantic` schemas/fixtures/instructions; update evidence docs.

- [ ] Re-read current Bazantic prize and product docs; create account and record non-secret identifiers.
- [ ] Register Mandate Inspector as a new paid x402/MPP service with smallest practical test price.
- [ ] Connect one live 1inch trace/data service and Mandate Inspector in one Recipe keyed by exact chain/tx hash.
- [ ] Validate provider response schemas, hashes, timeouts, and disagreement behavior; no provider alone may manufacture `COMPLIANT`.
- [ ] Execute the Recipe from request and payment through combined response against the real demo transaction.
- [ ] Record payment/evidence/request IDs and a redacted screen capture; include required account attribution in submission.
- [ ] Add contract/integration tests for `NON_COMPLIANT`, `UNKNOWN`, mismatched tx, and unavailable provider.
- [ ] Commit `feat: publish paid Mandate receipt audit Recipe`.

Acceptance: a judge can replay the working Recipe and see distinct, necessary contributions from 1inch and Mandate.

## Task 12: Security review, deployment, and submission proof

**Files:** final verified manifests, evidence index, submission copy, demo script, and only necessary fixes.

- [ ] Run contract/security review using `mandate-security-auditor` against exact commit; fix critical/high and documented medium findings or remove affected scope.
- [ ] Run full release commands from INSTALLATION on a clean checkout and fresh database/local chain.
- [ ] Verify Sepolia contracts/source, public API/web URLs, Bazantic Recipe, repository history, and explorer links from an unauthenticated browser where appropriate.
- [ ] Canary with very small caps; prove successful execution and each independent stop path.
- [ ] Run secret scanner and manually inspect browser bundles/logs/video for credentials or owner/agent keys.
- [ ] Record five-minute-or-shorter demo: owner custody, identity, exact policy, simulation, execution, balance/Aqua receipt, cap failure, revoke, repeated failure, Bazantic audit.
- [ ] Write submission copy using only verified claims and current track wording; distinguish official, self-deployed, fixture, and fork components.
- [ ] Tag the reviewed commit only after all evidence references resolve.

Acceptance: every spoken/written claim maps to source, passing command, transaction, deployment, or recording; no actionable release blocker remains hidden.

## Critical path and cut line

Critical path: Tasks 1 -> 2 -> 3 -> 4 -> 5 -> 7 -> 9 -> 12. Task 6 joins before public real-settlement claims. Task 8 is required for persistent audit; a read-through chain audit without database may be used only if time forces an explicit scope reduction approved by the owner. Task 10 direct/manual agent mode precedes autonomous signer polish. Task 11 is required only for Bazantic submission but must remain a meaningful product flow.

If schedule compresses, remove in this order: automated agent loop, persistent worker/database, Motion polish. Never remove contract identity checks, caps/rate/route/recipient constraints, Aqua balance proof, revocation proof, or honest deployment labels.

## Plan self-review checklist

- [ ] Every PRD required capability maps to a task and acceptance statement.
- [ ] Strategy field names and types match PRD, ERD, Architecture, and Smart Contract.
- [ ] Contract error selectors map one-to-one to stable API reasons.
- [ ] No step assumes unverified deployment address, route, or sponsor rule.
- [ ] No placeholder enters executable/configured artifacts.
- [ ] Test commands exist before the plan asks release automation to run them.
- [ ] Relayer/session/multi-strategy features remain excluded.
