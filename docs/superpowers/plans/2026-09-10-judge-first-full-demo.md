# Judge-First Full Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use test-driven-development and implement task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a fast, judge-completable Privy issuance and inspector experience with bounded automated demo-agent execution, persistent receipt URLs, and a visually strong but chain-honest Bazantic evidence lane.

**Architecture:** The root web shell becomes server-first; Privy loads only for issuance and lazy owner controls. A separate `@mandate/agent` HTTP process accepts only chain ID plus strategy hash, derives the fixed demo execution internally, runs the existing constrained signer runtime, and returns canonical evidence. The inspector becomes a progressive-disclosure control room and presents Sepolia execution and Ethereum-mainnet Bazantic assurance as complementary lanes.

**Tech Stack:** TypeScript 5.9 ESM, React 19, Next.js 16 App Router with Webpack, Privy React Auth 3.41, viem 2.56, Zod 4.5, Vitest 5, Playwright 1.58, Node HTTP.

**Spec:** `docs/superpowers/specs/2026-09-10-judge-first-full-demo-design.md`

## Global Constraints

- Never expose the agent keystore, password, account object, signed raw transaction, API key, RPC URL, or full environment.
- `apps/api` remains read/simulate/audit-only and never signs.
- The browser cannot choose destination, calldata, selector, signer, route target, native value, or simulation evidence for automated execution.
- Preserve exact `StrategyV1`, live ENS, Aqua, simulation freshness, canonical receipt, and fail-closed semantics.
- Privy owner smart account is the maker for every login method; external EOA is authentication, not direct mandate custody.
- Bazantic mainnet route assurance and Sepolia execution remain visibly separate evidence lanes.
- Reuse existing React/Tailwind/viem/Privy dependencies; add no UI framework, query library, wallet framework, queue, or custom MCP server.
- Preserve `reference/logo-crop-view.png` as user-owned untracked work.

---

### Task 1: Shared policy profile and demo-agent wire contract

**Files:**

- Modify: `packages/domain/src/index.ts`
- Modify: `packages/domain/test/domain.test.ts`
- Modify: `apps/web/src/lib/policy.ts`
- Modify: `apps/web/test/policy.test.ts`

**Interfaces:**

- Produces: `PolicyProfileV1Schema`, `PolicyProfileV1`, and `parsePolicyProfileJson(value)` from `@mandate/domain`.
- Produces: `DemoExecutionRequestV1Schema` and `DemoExecutionRequestV1` with exactly `{ chainId, strategyHash }`.
- Produces: `DemoExecutionResultV1Schema` and `DemoExecutionResultV1`, a discriminated union:
  - `{ status: "CONFIRMED", txHash, execution, audit }`
  - `{ status: "REJECTED", reason }`
  - `{ status: "UNKNOWN", errorId }`
- Consumes: existing address/hash/reason/execution/audit schemas.

- [ ] **Step 1: Write failing domain tests**

Add tests that prove the policy profile parser accepts the complete existing shape, rejects unknown fields and malformed selectors, and never returns a partial profile. Add tests proving the demo request rejects `to`, `data`, `value`, `amountIn`, and arbitrary extra fields. Add tests for all three result variants and rejection of mismatched canonical success fields.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `pnpm --filter @mandate/domain test -- domain.test.ts`

Expected: failure because the new schemas/parser do not exist.

- [ ] **Step 3: Implement the minimum schemas and parser**

Define a strict profile schema using existing nonzero address/hash/selector constraints plus token decimals `0..255`. Implement JSON parsing as a pure `undefined`-on-invalid helper. Define strict demo request/result schemas; on `CONFIRMED`, refine that `txHash`, chain ID, and strategy hash agree across the execution and audit evidence.

Update web policy imports to consume the shared type/parser while retaining `compilePolicy` in the web module. Remove the duplicate profile parsing implementation.

- [ ] **Step 4: Run focused domain and web policy tests**

Run: `pnpm --filter @mandate/domain test -- domain.test.ts && pnpm --filter @mandate/web test -- policy.test.ts`

Expected: both focused contracts pass.

### Task 2: Bounded automated demo-agent service

**Files:**

- Create: `apps/agent/src/demo.ts`
- Create: `apps/agent/src/server.ts`
- Create: `apps/agent/test/demo.test.ts`
- Create: `apps/agent/test/server.test.ts`
- Modify: `apps/agent/src/index.ts`
- Modify: `apps/agent/package.json`
- Modify: `.env.example`
- Modify: `docs/technical/INSTALLATION.md`

**Interfaces:**

- Consumes: `DemoExecutionRequestV1`, `DemoExecutionResultV1`, `PolicyProfileV1`, `MandateChainService`, `runAutomatedExecution`, and `createDedicatedKeystoreSigner`.
- Produces: `createDemoExecutionService(dependencies).execute(rawInput)`.
- Produces: HTTP `POST /v1/demo-executions` and `GET /health` on `AGENT_PORT` default `3002`.
- Produces: package script `dev` for the HTTP watcher while preserving one-shot `start`.
- Configuration: `MANDATE_DEMO_AGENT_ENABLED=true`, `AGENT_PORT=3002`, existing chain/app/profile/faucet/keystore variables.

- [ ] **Step 1: Write failing pure service tests**

Cover exact request admission, strategy lookup, fixed profile comparisons, dynamic strategy hash binding, demo amount `min(1 token, per-call remaining, total remaining, Aqua balance)`, ceiling minimum-output calculation, internally encoded fixed venue calldata, deadline strictly between now and mandate expiry, exact simulation, and delegation to automated runtime. Prove wrong chain/agent/ENS/token/target/selector, expired/revoked authority, zero remaining balance, invalid extras, and unavailable dependencies return `REJECTED` or `UNKNOWN` without invoking the signer.

- [ ] **Step 2: Verify the pure tests fail for missing behavior**

Run: `pnpm --filter @mandate/agent test -- demo.test.ts`

Expected: failure because `createDemoExecutionService` does not exist.

- [ ] **Step 3: Implement pure demo execution orchestration**

Parse the shared request. Read the activated strategy. Derive an `AgentPolicy` from the operator profile and current strategy hash while retaining fixed signer, ENS, token, route, recipient, and operator cap. Use `MANDATE_SEPOLIA_FAUCET_AMOUNT` as the maximum accepted demo strategy cap and exactly one input token as the preferred execution amount. Build `swap(uint256,uint256,address)` calldata internally, request a fresh exact simulation, then call `runAutomatedExecution`. Map `AgentRejection` to stable rejection and unexpected failures to a SHA-256 `errorId`.

- [ ] **Step 4: Write and verify failing HTTP boundary tests**

Test `POST /v1/demo-executions` with valid JSON, invalid JSON, oversized/extra-field input, disabled demo mode, and unexpected service failure. Test `GET /health`. Assert response/log data never contains configured password or keystore content.

Run: `pnpm --filter @mandate/agent test -- server.test.ts`

Expected: failure because the HTTP server boundary does not exist.

- [ ] **Step 5: Implement the Node HTTP boundary**

Use `node:http`; do not add Hono to the signer package. Limit body size, require JSON, set `cache-control: no-store`, and emit only structured safe status/error IDs. Load the encrypted signer once at startup only when explicit demo mode is enabled. Reuse existing chain and signer construction; do not put signing in `apps/api` or Next.

- [ ] **Step 6: Run all agent tests and typecheck**

Run: `pnpm --filter @mandate/agent test && pnpm --filter @mandate/agent typecheck`

Expected: all agent contracts pass with no type errors.

### Task 3: Finite Privy lifecycle and explicit issuance readiness

**Files:**

- Modify: `apps/web/src/components/providers.tsx`
- Modify: `apps/web/src/app/layout.tsx`
- Modify: `apps/web/src/app/issue/page.tsx`
- Create: `apps/web/src/lib/issuance.ts`
- Create: `apps/web/test/issuance.test.ts`
- Modify: `apps/web/src/lib/policy.ts`
- Modify: `apps/web/src/components/mandate/authority-composer.tsx`
- Modify: `apps/web/src/components/mandate/demo-faucet.tsx`

**Interfaces:**

- Produces: `createIssuanceDefaults(now, offset)` with 1 USDC, rate 1, and local 24-hour expiry.
- Produces: `reviewPolicyDraft(...)` returning strategy plus field-specific issues instead of silent `undefined`.
- Produces: `authorizationChecklist(...)` whose visible items and `canAuthorize` derive from the same booleans.
- Privy config: `createOnLogin: "all-users"`, EVM-only email/wallet login.

- [ ] **Step 1: Write failing issuance state tests**

Test deterministic defaults, past expiry, expiry beyond contract duration, zero/invalid rate, invalid/max spend, unavailable smart account, insufficient funding, policy readiness failure, and a fully ready state. Assert every false `canAuthorize` has at least one visible actionable reason.

- [ ] **Step 2: Verify issuance tests fail**

Run: `pnpm --filter @mandate/web test -- issuance.test.ts`

Expected: failure because the state helpers do not exist.

- [ ] **Step 3: Implement pure issuance helpers**

Keep decimal/base-unit arithmetic in `compilePolicy`. Add only the pure defaults, typed field issues, and checklist derivation needed by the UI. Do not create a form framework.

- [ ] **Step 4: Route-scope Privy**

Remove `MandateProviders` from the root layout. Wrap only `/issue` issuance with it. Configure all-user embedded signer creation and explicit EVM login methods. This must remove Privy from landing/read-only inspector bundles while preserving issuance context.

- [ ] **Step 5: Rebuild the issuance workspace**

Render a four-stage progress rail, finite wallet preparation with a bounded timeout and retry/sign-out recovery, human-readable demo funding, prefilled economic limits, inline field errors, a visible activation checklist, and one review sentence. Keep exact strategy data under “Technical strategy evidence”. Ensure wallet rejection/revert preserves all values.

- [ ] **Step 6: Run issuance and existing wallet tests**

Run: `pnpm --filter @mandate/web test -- issuance.test.ts policy.test.ts demo-faucet.test.ts privy-wallet.test.ts policy-readiness.test.ts`

Expected: all issuance contracts pass.

### Task 4: Persistent receipt URL and constrained agent UI

**Files:**

- Create: `apps/web/src/app/api/agent-executions/route.ts`
- Create: `apps/web/src/lib/agent-proxy.server.ts`
- Modify: `apps/web/src/lib/runtime.server.ts`
- Modify: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/components/mandate/agent-run.tsx`
- Create: `apps/web/test/agent-run.test.ts`
- Modify: `apps/web/src/app/mandates/[strategyHash]/page.tsx`
- Modify: `apps/web/src/components/mandate/inspector.tsx`

**Interfaces:**

- Server-only origin: `MANDATE_AGENT_ORIGIN`, default `http://127.0.0.1:3002`.
- Browser operation: `runDemoAgent({ chainId, strategyHash }): Promise<ApiState<DemoExecutionResultV1>>`.
- Inspector props: initial optional canonical `txHash` parsed from search params.
- URL after submission: `/mandates/<strategyHash>?justIssued=1&tx=<txHash>`.

- [ ] **Step 1: Write failing API/client state tests**

Prove the Next route forwards only the original strict JSON body and safe headers, maps unavailable origin to 503, and validates all responses. Prove inspector initialization loads receipt/audit when `tx` is valid and ignores malformed hashes.

- [ ] **Step 2: Verify focused tests fail**

Run: `pnpm --filter @mandate/web test -- agent-run.test.ts mandate.test.ts`

Expected: failure because the proxy/client/query behavior does not exist.

- [ ] **Step 3: Implement agent proxy and validated client**

Mirror the existing API proxy pattern with a separate server-only origin. Never forward cookies, authorization, wallet state, arbitrary headers, or query-controlled upstream paths. Parse shared result schemas before returning ready state.

- [ ] **Step 4: Implement the agent-run timeline**

Use the already loaded snapshot to display authority and ENS evidence, then call the bounded agent operation. Show WAITING/RUNNING/PASS/FAIL/UNKNOWN states without simulated success. On confirmation, set execution/audit state and replace the URL with its transaction hash. Bounded polling may reconcile API/worker evidence; missing/reorged evidence never becomes compliant.

- [ ] **Step 5: Preserve local/manual execution mode**

Retain the existing raw simulation and injected-agent wallet path only when `runtime.local` is true. Sepolia uses the judge-safe automated agent UI.

- [ ] **Step 6: Run web API and agent-run tests**

Run: `pnpm --filter @mandate/web test -- agent-run.test.ts mandate.test.ts manual-agent-wallet.test.ts`

Expected: all focused behaviors pass.

### Task 5: Inspector control room and lazy smart-account owner controls

**Files:**

- Modify: `apps/web/src/components/mandate/inspector.tsx`
- Modify: `apps/web/src/components/mandate/authority-header.tsx`
- Modify: `apps/web/src/components/mandate/order-summary.tsx`
- Modify: `apps/web/src/components/mandate/constraint-ledger.tsx`
- Modify: `apps/web/src/components/mandate/aqua-balances.tsx`
- Modify: `apps/web/src/components/mandate/flow-trace.tsx`
- Modify: `apps/web/src/components/mandate/receipt-plate.tsx`
- Modify: `apps/web/src/components/mandate/strategy-fields.tsx`
- Create: `apps/web/src/components/mandate/owner-controls.tsx`
- Modify: `apps/web/src/lib/privy-wallet.ts`
- Create: `apps/web/test/owner-controls.test.ts`

**Interfaces:**

- Produces: smart-wallet revoke/dock call builders using the existing batched client type.
- Owner controls require `client.account.address === snapshot.strategy.maker` before enabling any write.
- Read-only inspector does not render/import the Privy island until “Manage authority” is opened.

- [ ] **Step 1: Write failing owner-control tests**

Test correct smart-account equality, wrong-account denial, exact revoke calldata, exact Aqua dock calldata, rejection preservation, and absence of writes when account/client is unavailable.

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter @mandate/web test -- owner-controls.test.ts`

Expected: failure because the smart-wallet owner controls do not exist.

- [ ] **Step 3: Implement lazy owner controls**

Create a dynamically imported client island that wraps itself with `MandateProviders` only when opened. Reuse `submitSmartWalletCalls`; build exact revoke/dock calls internally. Keep the existing injected-wallet revocation for local E2E only.

- [ ] **Step 4: Recompose inspector information hierarchy**

Create the above-fold control room, compact section navigation, human token/timestamp formatting, Overview/Agent run/Evidence/Safety groups, and a single technical disclosure. Reuse existing panels where their data contract is sound; delete duplicated address/base-unit presentations rather than restyling all of them.

- [ ] **Step 5: Run inspector and owner-control tests**

Run: `pnpm --filter @mandate/web test -- owner-controls.test.ts mandate.test.ts manual-agent-wallet.test.ts`

Expected: all focused behaviors pass.

### Task 6: Bazantic machine-economy showpiece

**Files:**

- Create: `apps/web/src/lib/bazantic-proof.server.ts`
- Create: `apps/web/src/components/mandate/bazantic-lane.tsx`
- Create: `apps/web/test/bazantic-lane.test.ts`
- Modify: `apps/web/src/app/mandates/[strategyHash]/page.tsx`
- Modify: `apps/web/src/components/mandate/inspector.tsx`

**Interfaces:**

- Consumes: public, credential-free `integrations/bazantic/paid-proof.json`.
- Produces: a minimal parsed view model containing Recipe handle/ID/result, evidence hashes, paid ingredient settlement references, network, amounts, and Recipe-level `payment: null`.
- No browser or public response receives grant credentials or unpublished payment authorization.

- [ ] **Step 1: Write failing proof/parser tests**

Test valid checked-in proof, rejection of malformed proof, explicit `Ethereum mainnet` route-assurance label, explicit `Sepolia` receipt label, two paid Base settlement references, and visible Recipe-level unpaid distinction.

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter @mandate/web test -- bazantic-lane.test.ts`

Expected: failure because the safe view model and panel do not exist.

- [ ] **Step 3: Implement server-only proof projection**

Parse the checked-in JSON with a narrow schema and return only public proof fields. Do not send payer address, grant ID, grant cap, or revoked-grant metadata to the browser because they do not improve the judge story.

- [ ] **Step 4: Implement the Bazantic lane**

Render a strong two-service trace (`1inch Classic → Mandate Inspector`), Recipe status, evidence bindings, paid ingredient badges and Base explorer links. Render `Recipe call: unpriced` for `payment: null`. Pair it visually with—but never causally merge it into—the Sepolia execution lane. Do not add a fake live rerun when the upstream is unavailable.

- [ ] **Step 5: Run Bazantic panel tests**

Run: `pnpm --filter @mandate/web test -- bazantic-lane.test.ts`

Expected: all chain-honesty and projection checks pass.

### Task 7: End-to-end judging proof, performance, and documentation

**Files:**

- Modify: `apps/web/e2e/authority.spec.ts`
- Modify: `docs/technical/INSTALLATION.md`
- Modify: `docs/technical/INTEGRATIONS.md`
- Modify: `docs/BUILD-PLAN.md`
- Modify only if user-facing commands changed: root or app package scripts

**Interfaces:**

- Full development command runs web, API, worker, and demo-agent service.
- One-shot agent command remains available for file-based intents.

- [ ] **Step 1: Update durable E2E behavior**

Keep the local deterministic issue/inspect/simulate/execute/revoke path. Add behavior assertions for visible issuance blockers, default human values, automatic strategy-hash navigation, receipt query restoration, compact section navigation, Bazantic chain labels, keyboard controls, 375 px width, and reduced motion. Do not assert CSS class names or source text.

- [ ] **Step 2: Run focused and full verification**

Run:

```bash
pnpm --filter @mandate/domain test
pnpm --filter @mandate/agent test
pnpm --filter @mandate/web test
pnpm --filter @mandate/domain typecheck
pnpm --filter @mandate/agent typecheck
pnpm --filter @mandate/web typecheck
pnpm --filter @mandate/web build
pnpm docs:verify
pnpm secrets:scan
```

Expected: zero test/type/build/doc/secret failures. Existing third-party optional-module build warnings must be reported, not relabeled as clean output.

- [ ] **Step 3: Start actual services**

Start the API, worker, web, and agent HTTP process with their real development commands. Confirm API port 3001, agent port 3002, and web port 3100. Record worker errors honestly rather than calling a process healthy based only on liveness.

- [ ] **Step 4: Exercise actual browser surfaces**

Use the actual browser at desktop and 375 px. Exercise fresh authentication where the environment permits, wallet preparation, faucet, defaults, activation, navigation, automated agent run, canonical evidence, URL reload, owner controls, and Bazantic presentation. If a live wallet signature cannot be performed in the controlled browser, run the deterministic local E2E plus a production UI smoke and state the unexercised signed boundary exactly.

- [ ] **Step 5: Measure production performance**

Compare navigation timing and transferred JavaScript for `/`, `/issue`, and the active inspector against the recorded baseline (`/issue`: 642 ms load, 964,538 script-transfer bytes on this workstation). Verify landing and read-only inspector no longer load Privy chunks. Report measurements without extrapolating to hosted production.

- [ ] **Step 6: Clean up and update commands**

Remove throwaway performance artifacts. Document that full browser E2E needs web + API + worker + agent service, while one-shot `pnpm --filter @mandate/agent start -- <intent.json>` remains separate. Update Bazantic copy with the mainnet/Sepolia boundary.

- [ ] **Step 7: Commit and push**

Stage only intended files, excluding `reference/logo-crop-view.png`. Commit the completed judge-first implementation with a descriptive conventional commit and push `feat/task-11-bazantic`.
