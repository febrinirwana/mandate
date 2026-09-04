# Mandate Design System

> Superseded 2026-09-05. The canonical record of the built visual world is
> [`apps/web/DESIGN.md`](../apps/web/DESIGN.md), documented from `apps/web`
> after the redesign. The notes below summarize it for product docs; when
> they disagree with the code, the code and DESIGN.md win.

## Direction

Mandate looks like a **signed operating order**: railgun.org's public-web
grammar — halftone dot-matrix artwork, hairline ruling, monumental grotesk at
weight 400, marginal chapter numerals — carrying Mandate's own semantics: a
signed, revocable financial instrument, authorized in electric cobalt
(1inch Aqua track), with semantic state colors.

## Foundations

- **Palette:** ivory `#f6f5f0` / carbon `#1a1916` in light; carbon `#101013` /
  bone `#ecebe4` in dark. One accent: cobalt `#0000fe` (light) / `#8a91ff`
  (dark) — *authorization only*. States: confirmed `#17753c`, expiring
  `#8a6100`, revoked `#c03427`, unknown `#5e548e`, each with a soft tint.
  Lime is artwork-only.
- **Type:** Onest 400/500/600 (display at 400, tracking −0.042em) + Geist Mono
  for every hash, address, amount, and stamp label (tabular numerals).
- **Form:** 1px hairline ledger frame (max 1440px), full-height hero column
  rules, square tables, 4px control radius, detent nodes, printed state
  stamps (dot + uppercase mono label, color never alone).
- **Art:** the procedural halftone engine (`apps/web/src/components/dot/`) —
  seal-sun hero, nameplate / sealed-document / settlement-loop chapters,
  countersigned-page invariants panel, giant dotted wordmark footer.

## Motion

Scroll-driven with Motion (`useScroll`), one authored moment per section,
crossfades masked with 5px blur, ≤300ms UI transitions, exponential
ease-out, reduced-motion collapses pinning and entrances to static.

## Honest-state rules (unchanged product truth)

Sample data is labeled `SAMPLE`. Revocation flips every dependent surface.
`Submitted` is never `Confirmed`. Unknown fails closed. Simulation is
advisory: "PASS — SIMULATION ONLY". Full hashes/addresses ship in
`title`/`aria` with copy actions.
