---
name: mandate-frontend-polish
description: Use when building or reviewing Mandate UI, mandate creation, policy explanations, simulation gates, revocation, receipts, responsive layouts, accessibility, or motion.
---

# Mandate Frontend Polish

## Product meaning
Make delegated authority legible. The interface must answer, before every action: who may act, whose funds remain at risk, what exact action is allowed, how much remains, when authority ends, and how to revoke it.

## Required states
Render owner wallet, agent ENS name and full address, active/expired/revoked status, immutable strategy hash, pair, venue, rate floor, per-call/total caps, used/remaining amount, Aqua virtual balances, simulation block, expected movements, receipt, and failure reason.

## Interaction rules
- Creation is a reviewable sequence: identity, strategy, limits, exact summary, wallet signatures.
- Revocation is persistent and always reachable; destructive confirmation names the affected agent and strategy.
- Never label an API simulation as approval, execution, or guarantee.
- Use text, icon, and color for state; full keyboard operation; visible focus; WCAG 2.2 AA; reduced-motion behavior; 44px targets.
- Prefer CSS transitions. Use Motion for state/layout transitions; add GSAP only for a measured, coordinated sequence that Motion/CSS cannot express.
- After UI changes, drive the real surface through create, simulate pass, simulated fail, execute, revoke, stale data, wallet rejection, and narrow viewport flows.
