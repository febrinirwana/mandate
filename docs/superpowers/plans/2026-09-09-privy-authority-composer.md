# Privy Authority Composer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Sepolia Privy smart-wallet authority composer that turns constrained natural-language intent into an editable, verified Mandate `StrategyV1` and confirms it through a sponsored batch.

**Architecture:** A server-only proposal endpoint parses intent through a configured structured-output model, while a deterministic policy compiler resolves every onchain field from the audited Sepolia catalog. A root Privy provider exposes the owner smart wallet to the composer, which maintains one reviewable draft and submits only the byte-identical validated strategy after simulation passes.

**Tech Stack:** Next.js 16, React 19, TypeScript, Zod, viem, Privy React Auth, Privy Smart Wallets, Motion, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-09-privy-authority-composer-design.md`

## Global Constraints

- Target Sepolia only: chain ID `11155111`; read `SEPOLIA_MANDATE_APP` only in server runtime configuration.
- `NEXT_PUBLIC_PRIVY_APP_ID` may be exposed to the browser; `PRIVY_APP_SECRET`, `POLICY_AI_API_KEY`, and model credentials must not.
- Model output is draft data only. All token, venue, ABI, ENS, and strategy data must come from a trusted policy catalog and deterministic compiler.
- Only a current PASS simulation may enable authority confirmation.
- Preserve `SUBMITTED`, `CONFIRMED`, `REJECTED`, `REVERTED`, and unavailable states; never represent submitted as confirmed.
- Use existing ivory/carbon/cobalt visual system and Motion/CSS only. Preserve reduced-motion support, 44px target sizes, focus visibility, and 375px width.
- Skip project-wide validation during individual tasks. Run focused tests only; run full web verification once after integration.

---

### Task 1: Define constrained policy data and compiler

**Files:**
- Modify: `packages/domain/src/index.ts`
- Modify: `packages/domain/test/domain.test.ts`
- Create: `apps/web/src/lib/policy.ts`
- Create: `apps/web/test/policy.test.ts`

**Interfaces:**
- Produces `PolicyProposalV1Schema`, `PolicyProposalV1`, `PolicyDraftV1Schema`, and `compilePolicy(draft, context): StrategyV1`.
- Consumes the verified Sepolia manifest at `contracts/src/deployments/sepolia.json`, `StrategyV1Schema`, and `strategyHash`.
- `compilePolicy` accepts only an allowlisted token pair, configured route, registered agent reference, bounded human amount, rate floor, expiry, and current maker address.

- [ ] **Step 1: Write failing compiler tests**

```ts
it("ignores model-supplied addresses and compiles the Sepolia catalog pair", () => {
  const strategy = compilePolicy(validDraft, { maker, now: 1_770_000_000 });
  expect(strategy.tokenIn).toBe(SEPOLIA_USDC);
  expect(strategy.tokenOut).toBe(SEPOLIA_WETH);
  expect(strategy.swapTarget).toBe(SEPOLIA_ROUTE_TARGET);
});

it("rejects an unknown agent, expired policy, zero cap, and malformed proposal", () => {
  expect(() => compilePolicy({ ...validDraft, agent: "unregistered" }, context)).toThrow();
  expect(() => compilePolicy({ ...validDraft, validUntil: "2025-01-01T00:00:00Z" }, context)).toThrow();
  expect(PolicyProposalV1Schema.safeParse({ intent: "x", tokenIn: "USDC" }).success).toBe(false);
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `pnpm --filter @mandate/web test -- policy.test.ts`

Expected: FAIL because policy schemas and compiler do not exist.

- [ ] **Step 3: Add minimal schemas and deterministic catalog compiler**

```ts
export const PolicyProposalV1Schema = z.strictObject({
  version: z.literal(1),
  intent: z.string().min(1).max(800),
  agent: z.string().min(1),
  tokenIn: z.enum(["USDC"]),
  tokenOut: z.enum(["WETH"]),
  maxInput: PositiveDecimalStringSchema,
  minRate: PositiveDecimalStringSchema,
  expiresAt: z.string().datetime({ offset: true }),
});

export function compilePolicy(draft: PolicyDraftV1, context: PolicyContext): StrategyV1 {
  const catalog = sepoliaCatalog(context.mandateApp);
  return StrategyV1Schema.parse({ /* only catalog and validated draft values */ });
}
```

Use `parseUnits` for decimal conversion, derive `ensNode` with the verified namehash input, generate a fresh random `salt`, and validate every derived value with `StrategyV1Schema`. Do not accept a model-provided address, selector, raw calldata, or salt.

- [ ] **Step 4: Run focused tests**

Run: `pnpm --filter @mandate/web test -- policy.test.ts && pnpm --filter @mandate/domain test -- domain.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/domain/src/index.ts packages/domain/test/domain.test.ts apps/web/src/lib/policy.ts apps/web/test/policy.test.ts
git commit -m "feat: add deterministic policy compiler"
```

### Task 2: Add server-only AI proposal endpoint

**Files:**
- Create: `apps/web/src/lib/policy-model.server.ts`
- Create: `apps/web/src/app/api/policy-proposals/route.ts`
- Create: `apps/web/test/policy-model.test.ts`

**Interfaces:**
- Consumes `{ intent: string }`.
- Produces `{ kind: "PROPOSAL"; proposal: PolicyProposalV1 } | { kind: "CLARIFICATION"; message: string } | { kind: "UNAVAILABLE" }`.
- Reads `POLICY_AI_ENDPOINT`, `POLICY_AI_API_KEY`, and `POLICY_AI_MODEL` only on the server.

- [ ] **Step 1: Write failing endpoint tests**

```ts
it("returns unavailable without model configuration", async () => {
  await expect(createProposal("swap USDC to WETH", {})).resolves.toEqual({ kind: "UNAVAILABLE" });
});

it("rejects oversized intent before requesting the provider", async () => {
  await expect(route.request(new Request("http://app/api/policy-proposals", { method: "POST", body: JSON.stringify({ intent: "x".repeat(801) }) }))).resolves.toMatchObject({ status: 400 });
});

it("parses only strict structured provider output", async () => {
  await expect(createProposal("swap", configuredFetch(invalidModelJson))).resolves.toEqual({ kind: "CLARIFICATION", message: expect.any(String) });
});
```

- [ ] **Step 2: Run focused test and confirm it fails**

Run: `pnpm --filter @mandate/web test -- policy-model.test.ts`

Expected: FAIL because the endpoint does not exist.

- [ ] **Step 3: Implement the provider boundary**

Use native `fetch` to send an OpenAI-compatible JSON-schema response request. Include no deployment addresses in the prompt. Parse only JSON, validate it with `PolicyProposalV1Schema`, and return a concise clarification when parsing fails. Return `UNAVAILABLE` when all three required environment values are absent. Never return synthetic policy data.

- [ ] **Step 4: Run focused tests**

Run: `pnpm --filter @mandate/web test -- policy-model.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/policy-model.server.ts apps/web/src/app/api/policy-proposals/route.ts apps/web/test/policy-model.test.ts
git commit -m "feat: add guarded policy proposal endpoint"
```

### Task 3: Configure Privy and narrow smart-wallet adapter

**Files:**
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/components/providers.tsx`
- Create: `apps/web/src/lib/privy-wallet.ts`
- Create: `apps/web/test/privy-wallet.test.ts`

**Interfaces:**
- `MandateProviders({ children })` wraps `PrivyProvider` and `SmartWalletsProvider` only when `NEXT_PUBLIC_PRIVY_APP_ID` is configured.
- `useMandateWallet()` returns `{ kind: "LOADING" | "SIGNED_OUT" | "READY" | "UNAVAILABLE"; address?: Address; login(); submit(calls) }`.
- `submit(calls)` uses `client.sendTransaction({ calls })`; it never accepts an arbitrary string or model output.

- [ ] **Step 1: Write failing smart-wallet adapter tests**

```ts
it("submits an exact sequence of encoded calls through the smart-wallet client", async () => {
  await submitCalls(client, calls);
  expect(client.sendTransaction).toHaveBeenCalledWith({ calls });
});

it("does not submit when the client is unavailable", async () => {
  await expect(submitCalls(null, calls)).resolves.toEqual({ kind: "UNAVAILABLE" });
});
```

- [ ] **Step 2: Run focused test and confirm it fails**

Run: `pnpm --filter @mandate/web test -- privy-wallet.test.ts`

Expected: FAIL because the adapter does not exist.

- [ ] **Step 3: Add dependencies, root provider, and adapter**

Install `@privy-io/react-auth` and `permissionless` as documented by Privy. Create a client component provider nested inside `RootLayout`; use `NEXT_PUBLIC_PRIVY_APP_ID`, embedded EVM wallet creation for users without one, Sepolia default/supported chain, and `SmartWalletsProvider`. Preserve server rendering by keeping hooks out of `layout.tsx`.

Encode approvals, `ship`, and `activate` with existing ABI helpers. Build the call array only after `StrategyV1Schema.parse(strategy)` succeeds and the selected smart-wallet address equals `strategy.maker`.

- [ ] **Step 4: Run focused tests and typecheck**

Run: `pnpm --filter @mandate/web test -- privy-wallet.test.ts && pnpm --filter @mandate/web typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml apps/web/src/app/layout.tsx apps/web/src/components/providers.tsx apps/web/src/lib/privy-wallet.ts apps/web/test/privy-wallet.test.ts
git commit -m "feat: add Privy smart wallet boundary"
```

### Task 4: Replace raw issuance form with authority composer

**Files:**
- Modify: `apps/web/src/components/mandate/issuance.tsx`
- Create: `apps/web/src/components/mandate/authority-composer.tsx`
- Create: `apps/web/src/components/mandate/authority-review.tsx`
- Create: `apps/web/test/authority-composer.test.tsx`

**Interfaces:**
- `AuthorityComposer({ runtime })` owns the intent, proposal, editable draft, compiled strategy, simulation state, and confirmation state.
- `AuthorityReview({ strategy, proposal, simulation, onEdit })` renders human terms and exact expandable evidence.
- A proposal edit always clears previously compiled strategy, simulation, and wallet state.

- [ ] **Step 1: Write failing user-observable tests**

```tsx
it("prefills the guided editor from a proposal and invalidates approval after an edit", async () => {
  render(<AuthorityComposer runtime={runtime} />);
  await userEvent.type(screen.getByLabelText("Describe authority"), "Let Nova swap 100 USDC to WETH");
  await userEvent.click(screen.getByRole("button", { name: "Draft authority" }));
  expect(await screen.findByDisplayValue("100")).toBeVisible();
  await userEvent.clear(screen.getByLabelText("Maximum spend"));
  await userEvent.type(screen.getByLabelText("Maximum spend"), "200");
  expect(screen.getByRole("button", { name: /authorize/i })).toBeDisabled();
});

it("keeps exact onchain authority collapsed until the owner expands it", async () => {
  render(<AuthorityReview {...validReview} />);
  expect(screen.queryByText(validReview.strategy.swapTarget)).not.toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Exact onchain authority" }));
  expect(screen.getByText(validReview.strategy.swapTarget)).toBeVisible();
});
```

- [ ] **Step 2: Run focused test and confirm it fails**

Run: `pnpm --filter @mandate/web test -- authority-composer.test.tsx`

Expected: FAIL because the composer and review do not exist.

- [ ] **Step 3: Implement one-page composer**

Use the existing `Button`, `CopyValue`, `Stamp`, and CSS variables. Present a compact owner/network rail; the large command bar; example prompts; guided input fields; one living authority card; and a sticky confirmation dock only when strategy and simulation are valid. Replace the 17-field raw input grid completely. Maintain the existing inspect handoff after confirmed activation.

Use accessible `<label>` elements, `aria-live` for provider/simulation errors, `details` or a semantic button for exact evidence, and existing Motion primitives for subtle reveal/invalidated-state animation. Do not add a progress stepper or generic card grid.

- [ ] **Step 4: Run focused UI tests**

Run: `pnpm --filter @mandate/web test -- authority-composer.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/mandate/issuance.tsx apps/web/src/components/mandate/authority-composer.tsx apps/web/src/components/mandate/authority-review.tsx apps/web/test/authority-composer.test.tsx
git commit -m "feat: build intent-first authority composer"
```

### Task 5: Wire simulation, atomic confirmation, and receipt handoff

**Files:**
- Modify: `apps/web/src/lib/privy-wallet.ts`
- Modify: `apps/web/src/components/mandate/authority-composer.tsx`
- Modify: `apps/web/src/lib/wallet.ts`
- Modify: `apps/web/test/authority-composer.test.tsx`

**Interfaces:**
- Consumes the current compiled strategy, existing `simulate`, and `readAquaAddress`.
- Produces `WalletState` and inspect link only from a confirmed receipt.
- Confirmation is disabled without runtime, owner identity, Aqua address, and current PASS simulation.

- [ ] **Step 1: Add failing confirmation tests**

```tsx
it("cannot authorize when the current simulation fails", async () => {
  render(<AuthorityComposer runtime={runtime} />);
  await reachReviewWithSimulation("FAIL");
  expect(screen.getByRole("button", { name: /authorize/i })).toBeDisabled();
});

it("shows submitted separately from confirmed and links only after confirmation", async () => {
  mockSmartWalletSend.mockResolvedValue(txHash);
  render(<AuthorityComposer runtime={runtime} />);
  await reachReadyReview();
  await userEvent.click(screen.getByRole("button", { name: /authorize/i }));
  expect(await screen.findByText(/submitted/i)).toBeVisible();
  expect(screen.queryByRole("link", { name: /inspect/i })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /confirm receipt/i }));
  expect(await screen.findByRole("link", { name: /inspect/i })).toHaveAttribute("href", expect.stringContaining("/mandates/"));
});
```

- [ ] **Step 2: Run focused test and confirm it fails**

Run: `pnpm --filter @mandate/web test -- authority-composer.test.tsx`

Expected: FAIL because simulation and smart-wallet receipt state are not connected.

- [ ] **Step 3: Implement guarded call sequence**

Read Aqua via the configured Mandate app, call existing simulation API with current strategy and canonical route request, encode exact token approval(s), Aqua ship, and Mandate activation from that strategy, then send the finite call array through the Privy adapter. Preserve and render the error/rejection/revert states. Confirm the returned receipt before enabling inspection.

- [ ] **Step 4: Run focused tests**

Run: `pnpm --filter @mandate/web test -- authority-composer.test.tsx && pnpm --filter @mandate/web test -- mandate.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/privy-wallet.ts apps/web/src/components/mandate/authority-composer.tsx apps/web/src/lib/wallet.ts apps/web/test/authority-composer.test.tsx
git commit -m "feat: confirm authority through Privy"
```

### Task 6: Finish accessibility, responsive behavior, and real browser proof

**Files:**
- Modify: `apps/web/src/app/globals.css`
- Modify: `apps/web/src/components/ui/copy-value.tsx`
- Create: `apps/web/playwright.config.ts`
- Create: `apps/web/e2e/authority-composer.spec.ts`
- Modify: `BUILD-PLAN.md`
- Modify: `INSTALLATION.md`

**Interfaces:**
- The E2E test uses the real local Anvil fixture and a test EIP-1193 provider; it does not mock contract outcomes.
- Browser test asserts no horizontal scroll at 375px and keyboard-visible focus.

- [ ] **Step 1: Add failing browser and focused visual tests**

```ts
test("owner can edit a drafted authority and reach a real confirmed inspection", async ({ page }) => {
  await page.goto("/issue");
  await page.getByLabel("Describe authority").fill("Let Nova swap 100 USDC for WETH until tomorrow");
  await page.getByRole("button", { name: "Draft authority" }).click();
  await page.getByLabel("Maximum spend").fill("200");
  await expect(page.getByRole("button", { name: /authorize/i })).toBeDisabled();
  await completeValidReview(page);
  await expect(page.getByRole("link", { name: /inspect/i })).toBeVisible();
});

test("mobile composer has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/issue");
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 375);
});
```

- [ ] **Step 2: Run browser test and confirm it fails**

Run: `pnpm --filter @mandate/web exec playwright test e2e/authority-composer.spec.ts`

Expected: FAIL because the composer/browser harness does not exist.

- [ ] **Step 3: Implement focused polish**

Correct the global focus selector to `:focus-visible`, install a reduced-motion transition/animation kill switch, ensure copy controls are at least 44px, and remove mobile overflow. Configure Playwright to launch the web app with local fixture runtime configuration and inject the unlocked Anvil EIP-1193 provider before page hydration.

Document required web environment keys and Privy Dashboard setup in `INSTALLATION.md`. Check only the Task 9 items evidenced by tests/browser runs in `BUILD-PLAN.md`.

- [ ] **Step 4: Run final web verification**

Run:

```bash
pnpm --filter @mandate/web test
pnpm --filter @mandate/web typecheck
pnpm --filter @mandate/web lint
pnpm --filter @mandate/web build
pnpm --filter @mandate/web exec playwright test e2e/authority-composer.spec.ts
```

Expected: every command exits 0; browser test exercises the real local contract flow.

- [ ] **Step 5: Commit and push**

```bash
git add apps/web/src/app/globals.css apps/web/src/components/ui/copy-value.tsx apps/web/playwright.config.ts apps/web/e2e/authority-composer.spec.ts BUILD-PLAN.md INSTALLATION.md
git commit -m "feat: ship Mandate authority ledger experience"
git push origin feat/task-9-ui
```
