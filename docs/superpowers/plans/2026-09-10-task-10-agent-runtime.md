# Task 10 Agent Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: implement inline with test-driven-development; this task explicitly forbids subagents.

**Goal:** Build an isolated dedicated-agent runtime whose only signing capability is a fully validated `MandateAquaApp.execute` request.

**Architecture:** `apps/agent` exposes a strict typed intent, one preparation boundary, an opaque prepared request, and constrained automated/manual submission modes. Preparation reconstructs calldata with `@mandate/chain`, checks configured policy plus current chain inspection and an exact fresh PASS simulation, then either submits with a private keystore-backed account or returns the exact zero-value request for the existing dedicated browser-wallet path. The runtime waits for a canonical execution and audit from chain truth.

**Tech Stack:** TypeScript ESM, Zod domain schemas, viem, Vitest, existing Mandate chain/domain/contracts packages, Foundry/Anvil local fixtures.

**Spec:** `docs/BUILD-PLAN.md` Task 10 and the user-approved Task 10 execution contract.

## Global Constraints

- Never expose generic transaction, raw calldata, message, or arbitrary typed-data signing.
- Owner credentials never enter `apps/agent`; decrypted agent material stays private in the signer closure.
- Use base-unit `bigint` arithmetic and stable domain reason codes.
- Current block-stamped chain reads outrank persistence; all uncertainty fails closed.
- Automated and manual custody share one preparation boundary.
- No live Sepolia transaction without explicit authorization.

---

### Task 1: Constrained signer boundary

**Files:**

- Create: `apps/agent/package.json`, `apps/agent/tsconfig.json`
- Create: `apps/agent/src/config.ts`, `apps/agent/src/policy.ts`, `apps/agent/src/signer.ts`, `apps/agent/src/index.ts`
- Test: `apps/agent/test/policy.test.ts`, `apps/agent/test/signer.test.ts`

**Interfaces:**

- Consumes: `StrategyV1`, `SimulationV1`, `MandateSnapshotV1`, `buildExecutionCall`.
- Produces: strict `ExecutionIntent`, opaque `PreparedExecution`, `prepareExecution`, and a signer exposing only `submit(prepared)`.

- [ ] Write failing behavior tests for malformed intent, wrong chain/app/signer/strategy, unsupported token, bad route/recipient, cap/deadline/window violations, non-PASS/mismatched/stale/noncanonical simulation, and unavailable/revoked chain state.
- [ ] Run focused tests and confirm failures are caused by missing production modules.
- [ ] Implement strict startup config and independent preparation checks with stable reason-coded rejection.
- [ ] Run focused tests and typecheck; confirm decrypted key material never crosses the signer closure.
- [ ] Commit and push the coherent signer milestone.

### Task 2: Execution orchestration and manual mode

**Files:**

- Create: `apps/agent/src/runtime.ts`, `apps/agent/src/process.ts`
- Test: `apps/agent/test/runtime.test.ts`, `apps/agent/test/manual.test.ts`
- Modify only if required: `apps/web/src/lib/wallet.ts`

**Interfaces:**

- Consumes: the Task 1 preparation boundary and `MandateChainService` inspection/simulation/execution/audit methods.
- Produces: `executeMandate(intent, mode)` returning canonical receipt/audit in automated mode or one exact prepared request in manual mode.

- [ ] Write failing tests for inspect-to-simulate ordering, immediate freshness recheck, exact send, canonical receipt, audit, fail-closed outages, and manual preparation parity.
- [ ] Run focused tests and confirm expected failures.
- [ ] Implement the minimum orchestration and server-side process wiring.
- [ ] Run focused tests and deterministic local Anvil smoke through inspect, PASS, send, receipt, and audit; reject one malicious request before submission.
- [ ] Commit and push the coherent runtime milestone.

### Task 3: Public skill, adversarial evals, and proof

**Files:**

- Create: `skill/SKILL.md`
- Create: `evals/agent-runtime.ts`, `evals/unsafe-raw-signer.ts`
- Test: `apps/agent/test/evals.test.ts`, `apps/agent/test/public-api.test.ts`
- Modify: `.env.example`, `docs/BUILD-PLAN.md`

**Interfaces:**

- Consumes: the production constrained runtime and a test/eval-only unsafe baseline.
- Produces: deterministic six-case comparison and public operator contract.

- [ ] Write failing eval/public-API tests covering wrong target, cap breach, stale simulation, revoked identity, malicious route, unknown evidence, and absence of generic signer methods.
- [ ] Run tests and confirm expected failures.
- [ ] Implement eval runner and public skill with schemas, stable reasons, freshness, examples, manual mode, non-capabilities, prevented submissions, and onchain bypass boundary.
- [ ] Run agent tests, lint, typecheck, evals, `pnpm verify`, and secret scan; remove throwaway fixtures/artifacts.
- [ ] Check Task 10 boxes only after evidence exists.
- [ ] Commit exactly `feat: constrain dedicated Mandate agent signer` and push the branch.
