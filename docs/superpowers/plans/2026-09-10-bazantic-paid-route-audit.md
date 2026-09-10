# Bazantic Paid Route Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use test-driven-development and implement inline in the current Task 11 branch; do not create a child worktree or delegate this plan.

**Goal:** Ship a paid Mandate Inspector gateway and replayable Bazantic Recipe whose decision requires a live 1inch route plus deterministic Mandate policy verification.

**Architecture:** A strict domain contract wraps available/unavailable 1inch evidence. A pure `@mandate/chain` assessor decodes the exact Classic Swap calldata, checks it against `StrategyV1`, and emits fail-closed evidence. The Hono API exposes the assessor through OpenAPI; Bazantic supplies x402/MPP and generated MCP.

**Tech Stack:** TypeScript 5.9 ESM, Zod 4.5, viem 2.56, Hono OpenAPI, Vitest 5, 1inch Classic Swap v6.1, Bazantic Gateway/Recipe.

**Spec:** `docs/superpowers/specs/2026-09-10-bazantic-paid-route-audit-design.md`

## Global Constraints

- Keep Sepolia receipt evidence and Ethereum-mainnet 1inch route evidence explicitly separate.
- A provider timeout, unavailable result, or malformed payload can never become `PASS`.
- Decode and validate 1inch calldata; never trust echoed request parameters.
- Keep 1inch, Bazantic, RPC, database, and wallet credentials server-only and absent from artifacts/logs.
- Add no custom payment server, MCP server, retry framework, cache, queue, Uniswap dependency, or generic API proxy.
- Preserve `reference/logo-crop-view.png` as user-owned untracked work.

---

### Task 1: Route assessment wire contract

**Files:**

- Modify: `packages/domain/src/index.ts`
- Modify: `packages/domain/test/domain.test.ts`

**Interfaces:**

- Consumes: existing `StrategyV1Schema`, decimal/address/hash primitives.
- Produces: `OneInchRouteEvidenceV1Schema`, `RouteAssessmentRequestV1Schema`, `RouteAssessmentV1Schema`, exported inferred types, and generated JSON schemas.

- [ ] **Step 1: Write failing schema tests**

Add tests proving an available provider envelope and a fail-closed assessment round-trip, and rejecting unknown fields, number amounts, cross-chain values, missing request IDs, unsafe reason values, and a positive result with a failed/unknown check.

- [ ] **Step 2: Run the focused domain test and verify RED**

Run: `pnpm --filter @mandate/domain test -- domain.test.ts`

Expected: FAIL because the route assessment exports do not exist.

- [ ] **Step 3: Implement strict schemas and invariants**

Use discriminated provider status, decimal strings for every integer, literal chain `1`, a dedicated route-reason enum, and `superRefine` so `PASS` is impossible when any check is not `PASS`.

- [ ] **Step 4: Run focused domain tests and typecheck**

Run: `pnpm --filter @mandate/domain test -- domain.test.ts && pnpm --filter @mandate/domain typecheck`

Expected: PASS with no diagnostics.

### Task 2: Deterministic 1inch policy assessor

**Files:**

- Modify: `packages/chain/src/route.ts`
- Create: `packages/chain/src/assessment.ts`
- Modify: `packages/chain/src/index.ts`
- Create: `packages/chain/test/assessment.test.ts`
- Modify: `packages/chain/test/route.test.ts` only when preserving typed admission behavior requires it

**Interfaces:**

- Consumes: `RouteAssessmentRequestV1`, `admitClassicSwapRoute`, `buildExecutionCall`.
- Produces: `assessClassicSwapRoute(input: RouteAssessmentRequestV1): RouteAssessmentV1` and stable typed route-admission failures.

- [ ] **Step 1: Write failing behavior tests**

Use one real encoded `swap(address,(...),bytes)` payload. Prove `PASS` for exact agreement; `FAIL` for target, selector, caller, recipient, token, amount, cap, minimum-rate, route-minimum, and deadline mismatches; `UNKNOWN` for unavailable and malformed provider responses.

- [ ] **Step 2: Run the focused assessor test and verify RED**

Run: `pnpm --filter @mandate/chain test -- assessment.test.ts`

Expected: FAIL because `assessClassicSwapRoute` does not exist.

- [ ] **Step 3: Implement the minimum pure assessor**

Parse the request, derive the strategy hash through `buildExecutionCall`, decode the provider response through the existing admission boundary, perform integer-only ceiling-rate/cap/deadline checks, hash a fixed normalized payload, and apply `FAIL > UNKNOWN > PASS` precedence.

- [ ] **Step 4: Run chain tests and typecheck**

Run: `pnpm --filter @mandate/chain test && pnpm --filter @mandate/chain typecheck`

Expected: PASS; existing route admission behavior remains intact.

### Task 3: Public Mandate Inspector operation

**Files:**

- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/services.ts`
- Modify: `apps/api/test/app.test.ts`
- Modify: `apps/api/test/services.test.ts` only if the service boundary needs a focused assertion

**Interfaces:**

- Consumes: `assessClassicSwapRoute` and `RouteAssessmentRequestV1Schema`.
- Produces: `POST /v1/routes/1inch/assess` documented in `/openapi.json` and `ApiServices.assessRoute`.

- [ ] **Step 1: Write failing HTTP contract tests**

Assert that OpenAPI exposes exactly five operations, valid input returns the service result and request ID, malformed input returns 400, service failures are redacted, and body/timeout limits remain effective.

- [ ] **Step 2: Run the focused API test and verify RED**

Run: `pnpm --filter @mandate/api test -- app.test.ts`

Expected: FAIL because the route and service method do not exist.

- [ ] **Step 3: Implement controller and production service wiring**

Register the OpenAPI route, keep policy logic outside the controller, and return only schema-validated assessment data. Do not add authentication or payment code to the upstream API.

- [ ] **Step 4: Run API tests and typecheck**

Run: `pnpm --filter @mandate/api test && pnpm --filter @mandate/api typecheck`

Expected: PASS with five documented operations.

### Task 4: Bazantic publication artifacts and truthful docs

**Files:**

- Create: `integrations/bazantic/oneinch-classic.openapi.json`
- Create: `integrations/bazantic/recipe.json`
- Create: `integrations/bazantic/fixtures/pass-request.json`
- Create: `integrations/bazantic/fixtures/unavailable-request.json`
- Create: `integrations/bazantic/README.md`
- Modify: `docs/technical/INTEGRATIONS.md`
- Modify: `docs/evidence/kickoff.md`
- Modify: `docs/BUILD-PLAN.md`

**Interfaces:**

- Consumes: deployed Mandate `/openapi.json`, live 1inch gateway tool, checked-in public mainnet manifest.
- Produces: one importable Recipe definition with fields `name`, `description`, `input_schema`, `input_example`, `output_example`, `prompt_template`, `model`, and `tool_bindings`.

- [ ] **Step 1: Add schema-valid public fixtures and narrow 1inch OpenAPI**

Describe only `GET /swap/v6.1/1/swap`; require explicit src/dst/amount/from/receiver/slippage/protocols/complexity and document bearer auth without embedding a value.

- [ ] **Step 2: Add one fail-closed Recipe definition**

Bind the live 1inch tool and Mandate assessment tool. Use exactly one `{{inputs}}`. Require the model to preserve raw provider output, call Mandate second, and return Mandate's result without upgrading `FAIL`/`UNKNOWN`.

- [ ] **Step 3: Replace impossible same-Sepolia-trace claims**

Document the supported mainnet route-assurance flow and separate Sepolia receipt audit. Record official Bazantic eligibility and current 1inch chain limitation without claiming cross-chain consensus.

- [ ] **Step 4: Validate JSON and documentation**

Run: `pnpm docs:verify && pnpm format:check`

Expected: PASS; fixture and Recipe files contain no credentials or placeholder secrets.

### Task 5: Public deployment and Bazantic paid proof

**Files:**

- Modify after deployment: `integrations/bazantic/README.md`
- Modify after proof: `docs/evidence/bazantic.md`

**Interfaces:**

- Consumes: public API origin, Bazantic account, server-side Bazantic/1inch credentials.
- Produces: active Mandate gateway, active 1inch gateway, published Recipe, paid x402/MPP request, and redacted replay evidence.

- [ ] **Step 1: Deploy and smoke the public API**

Call `/openapi.json`, one valid route assessment, one unavailable assessment, and one existing receipt audit from outside localhost. Record only public URL, response hashes, request IDs, status, and UTC timestamp.

- [ ] **Step 2: Register gateways at the smallest practical price**

Use Bazantic's dashboard with upstream secrets entered only into secret credential fields. Confirm generated MCP URLs and operation names; never copy credential values into chat or files.

- [ ] **Step 3: Create, draft-test, publish, and paid-test the Recipe**

Verify the Recipe invokes distinct 1inch and Mandate operations. A successful paid flow must return the same exact chain, route bindings, strategy hash, result, and evidence hashes as the Mandate response.

- [ ] **Step 4: Capture redacted submission evidence**

Record non-secret account username, gateway/Recipe slugs or IDs, request/payment/evidence IDs, public links, UTC timestamp, and a screen capture with all credentials and unrelated account data hidden.

### Task 6: Release verification and exact commit

**Files:**

- Modify: `docs/BUILD-PLAN.md` only after every checked item has evidence
- Verify: all Task 11 source, tests, integrations, and evidence files

**Interfaces:**

- Consumes: Tasks 1-5 outputs.
- Produces: one verified Task 11 branch ready for review and merge.

- [ ] **Step 1: Run focused behavior smoke**

Exercise one valid live 1inch response through the public paid Recipe, then submit an unavailable provider envelope and one mutated target payload. Observe `PASS`, `UNKNOWN`, and `FAIL` respectively.

- [ ] **Step 2: Run repository verification**

Run: `pnpm verify`

Expected: lint, tests, typecheck, format check, docs verification, and secret scan all PASS.

- [ ] **Step 3: Inspect public artifacts and staging boundary**

Confirm no credentials, authorization headers, RPC/database URLs, raw signed transactions, owner/agent key material, or `reference/logo-crop-view.png` are staged.

- [ ] **Step 4: Commit and push**

Commit exactly `feat: publish paid Mandate receipt audit Recipe` and push `feat/task-11-bazantic` to origin.
