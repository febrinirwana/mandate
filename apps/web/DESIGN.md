# Mandate — DESIGN.md

Recorded from the built `apps/web` world, not from intentions. The committed
direction: **the signed operating order** — railgun.org's editorial grammar
(hairline ruling, monumental grotesk at weight 400, marginal numerals) joined
to Mandate's own semantics: the mandate as a crisp printed artifact,
authorized in the 1inch Aqua track's electric blue.

**Light only.** The paper IS the product; dark mode was cut (user decision,
2026-09-05).

## World

- **Ground:** ivory ledger `#f6f5f0`, raised paper `#fffefb`, recess `#edece5`.
  Content sits inside a max-1440 ledger frame ruled by 1px hairlines; the hero
  adds full-height column rules.
- **Ink:** carbon `#1a1916`; secondary `#57544b`; tertiary `#8d8a7e`.
- **Accent — one voice:** electric cobalt `#0000fe` (deep `#0000c6`, soft
  `#e4e6ff`). It means *authorization*: active stamps, PASS, the primary
  action, the headline's terminal period, the certificate seal.
- **State colors (semantic, never decorative):** confirmed green `#17753c`,
  expiring ochre `#8a6100`, revoked vermilion `#c03427`, unknown violet
  `#5e548e`, each with a soft tint. Color never carries status alone: stamps
  pair a dot with an uppercase mono label.
- **Brand:** the user-supplied wordmark (`public/mandate-logo.png`, trimmed)
  is the only logo: carbon in the nav, ivory (`-ivory.png`) on the carbon
  footer. The favicon crops the `m` onto a carbon rounded square.

## Type

- **Onest** (400/500/600, self-hosted) — display at weight **400**, tracking
  `-0.042em`. Hero `clamp(3rem,7vw,5.75rem)`, section heads
  `clamp(2.25rem,4.6vw,4rem)`, pinned statements `clamp(1.875rem,4.2vw,3.75rem)`.
- **Geist Mono** (400/500) — every hash, address, amount, field name, stamp
  label. `.mono-data` = 13px/1.5 tabular. `.ledger-label` = 11px uppercase,
  tracking `0.08em`.
- Emphasis is weight or size of the same family. **No em dashes anywhere
  visible** (user rule): colons, middots, and sentence breaks instead.

## Signature components

1. **The Mandate certificate** (`components/art/certificate.tsx`) — the hero
   centerpiece: ruled paper with tabular mono fields, a signature that draws
   itself (SVG path, 1.15s), the cobalt rosette seal (14 scallops + 8-point
   star) spring-stamped at −8°, barcode strip, "Treasury custody retained"
   carbon bar. Pointer tilt (±3.5°), reduced-motion aware.
2. **Ruling engine** — 1px hairlines: column rules, table rules, chapter
   plate borders, margin numerals between hairline segments.
3. **Lucide plates** — chapters are bordered cards with a 64px icon cell
   (Fingerprint / FileSignature / settlement loop), staggered reveal, hover
   lift. Settlement runs a traveling cobalt dot across PULL → SWAP → PUSH.
4. **Printed marks** — square state stamps, detent flow-trace nodes, black
   pill section labels, barcode ticks.
5. **Radix primitives** (`ui/tooltip.tsx`, `mandate/revocation.tsx`) —
   carbon-chip tooltips on the built-on marquee; the revocation confirm uses
   the Radix dialog (focus trap, Escape, aria).

## Motion

One authored moment per surface; exponential ease-out (`--ease-out-expo`,
`--ease-out-quart`); crossfades masked with 5px blur; scroll-driven (Motion
`useScroll`), never time-jacked; UI transitions ≤300ms; transform/opacity +
blur only; the built-on strip is a 36s pausable marquee;
`prefers-reduced-motion` collapses pinning and entrances to static.

## Honest-state rules

`SAMPLE: synthetic demo state, not live chain data` labels all demo data;
revocation flips the whole page (header, ledger rows, gate, trace); submitted
≠ confirmed; unknown fails closed on the unknown-hash route. Countdown is
replaced by "stopped by owner: execution reverts" when revoked.
