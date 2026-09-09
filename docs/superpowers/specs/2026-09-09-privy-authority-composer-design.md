# Privy Authority Composer Design

**Goal:** Replace Mandate's protocol-operator issuance form with a Privy-powered, intent-first authority composer for a Sepolia treasury owner.

**Status:** Approved by the owner on 2026-09-09. The flow uses a natural-language prompt and a guided editor; it is not a chatbot that can grant or sign authority.

## Product outcome

An owner signs in with Privy, states a desired limited authority in ordinary language, reviews an editable policy card, and confirms one sponsored smart-wallet batch. The resulting authority is visible as a live, revocable ledger entry. A judge can expand the immutable `StrategyV1` and receipt evidence without making every owner operate at ABI level.

## Users and roles

- **Owner:** Authenticates through Privy and controls the Sepolia smart wallet. The smart-wallet address is `StrategyV1.maker`.
- **Agent:** A named, separately controlled address. It may execute only the active strategy.
- **Mandate backend:** Reads and audits chain state. It never owns or signs with the owner's wallet.
- **Policy model:** Parses intent into a proposal only. It cannot choose untrusted contracts, grant permissions, or send transactions.

## Chain and wallet configuration

- Target chain: **Sepolia** (`11155111`).
- Mandate app: `SEPOLIA_MANDATE_APP=0x34bd1a513858f33c8929b93E892725F80c106576`.
- Web runtime configuration belongs in `apps/web/.env.local`: `MANDATE_CHAIN_ID`, `SEPOLIA_MANDATE_APP`, `MANDATE_API_ORIGIN`, and `NEXT_PUBLIC_PRIVY_APP_ID`.
- `PRIVY_APP_SECRET` and the policy-model credential stay server-only. No secret receives a `NEXT_PUBLIC_` prefix.
- Privy Dashboard must enable a Sepolia compatible smart wallet and sponsored gas for this app. The app must not claim sponsorship if dashboard configuration is absent.

## Authority composer

### 1. Login and wallet readiness

The root app is wrapped in `PrivyProvider` and `SmartWalletsProvider`. The UI waits for Privy and wallet readiness, then shows one Mandate-styled action:

- unauthenticated: **Create secure wallet**;
- authenticated but no smart wallet: **Prepare secure wallet**;
- ready: the abbreviated owner address and **Continue**.

The page never exposes a generic injected-wallet selector as its primary path. The current injected-wallet helper remains only where needed for local fixture and agent execution until those paths are migrated deliberately.

### 2. Intent prompt plus guided editor

The primary surface is a large policy command bar, not a multi-step wizard. Suggested examples communicate the supported scope:

> Let Nova swap up to 1,000 USDC for ETH until Friday, never below 0.995 ETH per 1,000 USDC.

The model returns a strict `PolicyProposalV1` with only owner-editable intent fields: asset in, asset out, cap, price protection, expiry, and agent identity. The guided editor appears immediately below it and makes every field editable. Empty, ambiguous, or unknown proposals ask one concise clarification; they do not infer a token address or contract.

The compiler derives all protocol fields from trusted configuration and onchain reads: maker, registered agent address, ENS binding, configured token records, venue address, selector, decimal base units, `validAfter`, `validUntil`, and salt. It validates the derived strategy with `StrategyV1Schema` and displays the immutable hash only after that succeeds.

### 3. Authority review

The proposal resolves into one visual authority card:

- headline: **Nova can rebalance up to 1,000 USDC into ETH**;
- protections: per-call and total cap, minimum conversion rate, expiry, and output destination;
- provenance: named agent, ENS status, Sepolia network, and configured venue;
- risk copy: **No custody transfer. You can revoke this authority at any time.**

An expandable **Exact onchain authority** area shows the validated `StrategyV1`, base units, ABI bytes, hash, and simulation evidence. It starts collapsed. Editing any visible policy field invalidates the prior proposal, simulation, and confirmation state.

### 4. Confirmation

Before confirmation the app reads the actual Aqua address and runs the existing simulation gate. A PASS is required. The final CTA says exactly what will happen, for example:

> Authorize 1,000 USDC maximum

The Privy smart-wallet client submits a `calls` batch containing exact approvals, Aqua ship, and Mandate activation when contract semantics permit atomic execution. The batch comes only from the deterministic compiler output. The UI reports submitted, confirmed, rejected, reverted, and unavailable states distinctly. If batching cannot be used, it explains the required separate confirmations and does not compress them into a misleading success state.

### 5. Ledger

A confirmed strategy redirects to its existing live inspection route. The route remains the evidence surface for status, remaining capacity, Aqua balances, simulation, execution receipts, failure reasons, and reorg visibility. A persistent **Revoke authority** control is shown to the owner. Revocation always calls the real contract; no optimistic success is shown before a confirmed receipt.

## AI safety and server contract

`POST /api/policy-proposals` is same-origin and server-only. It receives `{ intent: string }` and returns a proposal parsed against a strict schema. The implementation must:

1. Reject requests over a fixed input length.
2. Request JSON-schema structured output from the configured provider.
3. Parse the response against `PolicyProposalV1Schema`.
4. Resolve all addresses and contract details from a trusted Sepolia policy catalog, never model output.
5. Return a validation or clarification response for unsafe/ambiguous intent.
6. Never invoke a wallet, RPC write, or Privy secret from this route.

The app returns an explicit unavailable state when the policy-model environment is not configured. It must not fake a proposal. The model credential will be added only after the provider and server key are supplied.

## Visual design system

Use the existing Mandate visual language: ivory paper, carbon ink, cobalt as the single authorization accent, ruled ledger lines, Onest display type, Geist Mono for exact evidence, and only Motion/CSS for motion.

The composer uses one vertically coherent page:

1. narrow status rail (Sepolia, owner wallet, security state);
2. oversized intent command bar;
3. live authority card with guided controls;
4. compact confirmation dock that becomes sticky after a valid simulated policy;
5. receipt/ledger handoff.

No progress stepper, modal maze, generic dashboard cards, gradients, or decorative crypto imagery. Controls have minimum 44px targets, visible focus state, keyboard operation, concise inline error text, reduced-motion support, and no horizontal overflow at 375px.

## Data and state invariants

- The displayed maker equals the Privy smart-wallet address at confirmation time.
- AI output never contains the final strategy's trusted contract addresses or raw ABI bytes.
- A policy edit clears prior hash, quote/simulation, and signature state.
- A policy is actionable only after strict schema validation, identity verification, and current PASS simulation.
- `SUBMITTED` is never presented as confirmed.
- Unknown RPC/API/model state fails closed and remains visible to the owner.
- The `StrategyV1` supplied to Aqua and Mandate is byte-for-byte the validated strategy whose hash is displayed.

## Files expected to change

- `apps/web/package.json`: Privy React and required smart-wallet dependencies.
- `apps/web/src/app/layout.tsx`: root client providers.
- `apps/web/src/components/providers.tsx`: Privy and smart-wallet provider boundary.
- `apps/web/src/app/api/policy-proposals/route.ts`: server-only structured proposal endpoint.
- `apps/web/src/lib/policy.ts`: strict proposal schema, deterministic compiler, policy catalog.
- `apps/web/src/lib/privy-wallet.ts`: narrow smart-wallet transaction adapter.
- `apps/web/src/components/mandate/issuance.tsx`: replace raw field grid with the composer.
- `apps/web/src/app/globals.css` and existing UI primitives: interaction, focus, responsive, and reduced-motion corrections.
- `apps/web/tests/*` and Playwright E2E: proposal validation and real UI transaction path.

## Verification

- Unit tests prove malformed/ambiguous model output cannot compile to a strategy and trusted catalog mappings determine contract fields.
- Web typecheck, lint, and focused component/API tests pass.
- Browser verification on Sepolia confirms Privy-ready/login state, editable proposal, invalidation after editing, blocked confirmation without PASS, and real receipt state handling.
- A local Anvil fixture remains for deterministic end-to-end tests; Sepolia is the judge-demo target.

## Deliberate exclusions

- AI never executes swaps or changes strategy after confirmation.
- Arbitrary natural-language venues, tokens, and agent addresses are not supported without a trusted catalog entry.
- The app does not create an ENS identity automatically; it verifies the configured binding and points to the correct owner action when identity setup is missing.
