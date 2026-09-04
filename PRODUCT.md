# Product

<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
Next.js web application, Hono API, TypeScript domain packages, Foundry/Solidity contracts, viem/wagmi wallet integration, PostgreSQL/Drizzle receipt evidence, a server-only dedicated agent signer, ENSv2 on Sepolia, 1inch Aqua, a fixed verified settlement venue, and a Bazantic x402/MPP Recipe.

## Users
- DAO or protocol treasury owner delegating one bounded token conversion without transferring treasury custody or sharing the owner key.
- Market-making or fund operator supervising a dedicated automation signer and needing immediate revocation.
- Agent developer consuming typed simulation and receipt evidence rather than an opaque natural-language permission.
- Auditor reviewing who acted, under which immutable strategy, against which ENS identity and remaining budget.

## Product Purpose
Mandate lets a treasury issue a narrow, expiring, revocable onchain mandate to a named agent. The owner keeps assets in its wallet; the agent can execute only the strategy hash, pair, venue, rate floor, caps, and time window the owner approved; Aqua performs wallet-custodied pull/push settlement.

## Positioning
Mandate is **an authorization firewall for agent-operated liquidity**, not an AI trading bot, wallet, swap frontend, vault, or generic permission framework. The product makes delegated authority inspectable before execution and undeniable after execution.

## Operating Context
The owner registers a dedicated signer under an ENSv2 subname, approves Aqua, ships an immutable strategy, and activates the matching hash in Mandate. The agent requests a deterministic simulation, then signs its own onchain execution. `MandateAquaApp` repeats authorization and policy checks, pulls only bounded input from the treasury through Aqua, settles through one fixed route, and pushes output back to the treasury. A Bazantic Recipe combines Mandate receipt evidence with a live 1inch trace/data call for paid machine-readable audit.

## Capabilities and Constraints
- One maker, one agent EOA, one ENS identity, one pair, one fixed route target and selector, one strategy per demo.
- Agent EOA holds gas only; no owner key, treasury token, arbitrary allowance, or arbitrary call target.
- Onchain strategy is immutable. Parameter changes require revoke/dock and a new strategy.
- Owner can stop execution through Mandate revocation, Aqua docking, or ENS revocation/expiry.
- Simulation is advisory and state-bound. Only successful onchain checks authorize execution.
- Output recipient is always the maker; the agent cannot redirect proceeds.
- Plain language explains or drafts typed values but never calculates limits or overrides the contract.
- Unsupported token behavior, uncertain ENS state, stale simulation, unknown deployment, and missing receipt evidence fail closed.
- No multi-chain execution, portfolio optimizer, dynamic target allowlist, governance system, agent marketplace, credit, leverage, or cross-margin in MVP.

## Brand Commitments
Mandate feels like a signed operating order: precise, restrained, high-contrast, and materially financial. The interface uses an ivory ledger, carbon text, cobalt authorization marks, and vermilion only for revocation/failure. It must not resemble a neon trading terminal, generic AI dashboard, consumer wallet, or soft card grid. The wordmark is typographic until the user supplies a canonical asset; do not invent a mascot or logo mark.

## Product Principles
1. Authority before autonomy.
2. Identity is live state, not a label.
3. Simulation informs; the contract authorizes.
4. Treasury custody remains with the owner between transactions.
5. Immutable policy beats hidden prompt instructions.
6. Unknown fails closed.
7. One convincing execution and one convincing revocation beat broad integrations.

## Accessibility & Inclusion
WCAG 2.2 AA contrast, full keyboard operation, visible focus, semantic forms/tables, 44px targets, reduced motion, text plus icon plus color status, full-address accessible names, and plain-language explanations beside exact contract fields. Wallet connection is unnecessary for read-only mandate inspection.
