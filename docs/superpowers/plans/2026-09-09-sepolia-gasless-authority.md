# Sepolia Gasless Authority Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use test-driven development and execute each task in order. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a live Sepolia Privy smart-wallet journey that funds demo MockUSDC without ETH, issues exact Mandate authority, and exposes verifiable onchain evidence.

**Architecture:** Keep StrategyV1 compilation deterministic. Privy’s Alchemy smart wallet submits the existing atomic four-call authorization batch; a Sepolia-only faucet call mints the official ENSv2 MockUSDC to that same smart-wallet address. The Privy dashboard paymaster sponsors gas, while the server-only Sepolia RPC verifies contracts, identity, balances, and receipts.

**Tech Stack:** Next.js 16, React 19, Privy React Auth smart wallets, viem, Vitest, Playwright, Foundry, official Sepolia Aqua and ENSv2 deployments.

**Spec:** `docs/BUILD-PLAN.md` Task 9 and the approved Sepolia faucet design in the 2026-09-09 session.

## Global Constraints

- Use Sepolia MockUSDC as input and MockDAI as output; native Sepolia ETH is gas only.
- Never expose RPC, Privy secret, wallet key, Groq key, or paymaster credentials to browser bundles.
- Faucet is enabled only for chain `11155111` and an explicitly configured verified mintable test token.
- No LLM may compile, modify, or approve StrategyV1 authorization fields.
- Every wallet rejection preserves reviewed policy state; submitted is never labeled confirmed.
- Keep the local deterministic flow and public Sepolia flow separate and visibly labeled.

---

### Task 1: Sepolia faucet transaction boundary

**Files:**

- Modify: `apps/web/src/lib/privy-wallet.ts`
- Test: `apps/web/test/privy-wallet.test.ts`

**Interfaces:**

- Produces: `buildDemoFaucetCall(token, recipient, amount): SmartWalletCall`
- Produces: `submitSmartWalletCalls(client, calls): Promise<WalletState>` (existing)

- [ ] Write a failing test proving the faucet call targets only the configured token and mints the exact raw amount to the smart-wallet owner.
- [ ] Run the focused Vitest test and verify the missing interface is the failure.
- [ ] Encode `mint(address,uint256)` with no generic transaction surface.
- [ ] Run the focused test and verify it passes.

### Task 2: Verified funding state and UI

**Files:**

- Create: `apps/web/src/lib/demo-faucet.ts`
- Create: `apps/web/src/app/api/demo-funding/route.ts`
- Create: `apps/web/src/components/mandate/demo-faucet.tsx`
- Modify: `apps/web/src/lib/runtime.server.ts`
- Modify: `apps/web/src/components/mandate/authority-composer.tsx`
- Test: `apps/web/test/demo-faucet.test.ts`
- Test: `apps/web/test/runtime.test.ts`

**Interfaces:**

- Produces: strict `DemoFundingState` with raw balance, configured amount, symbol, decimals, and block number.
- Consumes: smart-wallet address, verified policy token, server-only RPC, and explicit Sepolia faucet amount.

- [ ] Write failing tests for Sepolia-only configuration, exact balance decoding, malformed account rejection, RPC outage, and exact mint call.
- [ ] Verify expected failures.
- [ ] Implement the server read boundary and accessible funding card with idle, submitting, submitted, confirmed, rejected, and unavailable states.
- [ ] Poll canonical balance after submission and enable issuance only when the smart wallet covers the selected cap.
- [ ] Run focused tests and verify they pass.

### Task 3: Fresh public Sepolia runtime

**Files:**

- Modify: `contracts/script/DeploySepolia.s.sol`
- Modify: `contracts/test/SepoliaScripts.t.sol`
- Modify: `packages/contracts/src/deployments/sepolia.json`
- Modify: `.env.example`

**Interfaces:**

- Produces: MandateAquaApp bound to pinned official Aqua and a fixed MockUSDC→MockDAI venue with funded output liquidity.
- Consumes: owner-authorized ENSv2 identity and deployment broadcaster supplied outside the repository.

- [ ] Write failing Foundry tests for wrong-chain, invalid treasury, token binding, venue output funding, and pinned Aqua code hash.
- [ ] Verify expected failures.
- [ ] Implement the minimum deployment script and public manifest fields.
- [ ] Run Foundry tests.
- [ ] Broadcast only after validating the broadcaster, treasury, agent identity, and available Sepolia gas.

### Task 4: Runtime profile and operator instructions

**Files:**

- Modify: `docs/technical/INSTALLATION.md`
- Modify: `apps/web/.env.local` (ignored; public onchain identifiers only)
- Modify: root `.env` (ignored; server-only values only)

**Interfaces:**

- Produces: exact `MANDATE_POLICY_PROFILE` from live code, metadata, identity, resolver, route, and selector reads.

- [ ] Document Privy/Alchemy smart-wallet bundler and gas-sponsorship setup with abuse limits and allowed domains.
- [ ] Verify token symbols/decimals, route target/selector, app/Aqua binding, ENS owner/resolver/address, and code at one live block.
- [ ] Generate the profile from verified reads rather than handwritten guesses.
- [ ] Restart web/API/worker and confirm readiness is `READY`.

### Task 5: Browser and release proof

**Files:**

- Create: `apps/web/playwright.config.ts`
- Create: `apps/web/e2e/authority.spec.ts`
- Modify: `docs/BUILD-PLAN.md`

**Interfaces:**

- Proves: login, faucet, review, authorization, inspection, simulation pass/fail, manual agent execution, receipt, revoke, repeated denial, wallet rejection, keyboard access, and 375px layout.

- [ ] Exercise the live Sepolia faucet and issuance in the actual Privy UI.
- [ ] Run the local deterministic complete flow for destructive/rejection cases.
- [ ] Add only stable consumer-observable Playwright coverage.
- [ ] Run web/chain tests, typecheck, lint, build, docs verification, formatting check, and secret scan.
- [ ] Commit `feat: ship Mandate authority ledger experience` and push the branch.
