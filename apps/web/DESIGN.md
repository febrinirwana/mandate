# Mandate — DESIGN.md

Recorded from the built `apps/web` world, not from intentions. The committed
direction: **the signed operating order** — railgun.org's public-web grammar
(halftone dot-matrix art, hairline ruling, monumental grotesk at weight 400,
marginal chapter numerals) joined to Mandate's own semantics (the mandate as a
signed, revocable financial instrument; the 1inch Aqua track's electric blue).

## World

- **Ground:** ivory ledger in light (`#f6f5f0`), carbon stage in dark
  (`#101013`). Content sits inside a max-1440 ledger frame ruled by 1px
  hairlines; the hero adds full-height column ruling.
- **Ink:** carbon `#1a1916` (light) / bone `#ecebe4` (dark). Secondary `#57544b`.
- **Accent — one voice:** electric cobalt `#0000fe` (Aqua-track nod; lightened
  to `#8a91ff` in dark). It means *authorization*: active stamps, PASS, the
  primary action, the headline's terminal period.
- **State colors (semantic, never decorative):** confirmed green `#17753c`,
  expiring ochre `#8a6100`, revoked vermilion `#c03427`, unknown violet
  `#5e548e`. Each has a soft ground tint. Color never carries status alone —
  every stamp pairs dot + uppercase mono label.
- **Art accents:** lime `#7ea51d`–`#b9e34e` appears only inside halftone
  artwork (chapters, invariants panel), never in UI state.

## Type

- **Onest** (400/500/600, self-hosted) — display at weight **400**, tracking
  `-0.042em`, the railgun voice. Hero `clamp(3rem, 8.2vw, 6.5rem)`, section
  heads `clamp(2.25rem, 4.6vw, 4rem)`, pinned statements
  `clamp(1.875rem, 4.2vw, 3.75rem)`.
- **Geist Mono** (400/500) — every hash, address, amount, field name, stamp
  label. `.mono-data` = 13px/1.5 tabular. `.ledger-label` = 11px uppercase,
  tracking `0.08em`.
- Emphasis is weight or size of the same family; no serif, no mixed families.

## Signature motifs

1. **Halftone dot-matrix art** — `components/dot/halftone.tsx` samples vector
   scenes (or the logo's alpha) on a grid and re-renders as dots with a radial
   cascade entrance and pointer parallax. Scenes live in `dot/scenes.ts`:
   the seal-sun over the settlement horizon (hero), the nameplate (identity),
   the sealed document (mandate), the pull/swap/push loop (settlement), the
   countersigned page (invariants), the giant dotted wordmark (footer).
2. **The ruling engine** — 1px hairlines everywhere: page-edge column rules,
   table rules, chapter rules under art, margin numerals between hairline
   segments.
3. **Printed marks** — square-ish state stamps (`Stamp`), detent nodes on the
   flow trace, black pill section labels (Invariants), square tables.

## Components

`kit.tsx` (Stamp, ButtonLink/Button — primary accent / carbon / ghost, all
with `:active` scale 0.97), `copy-value.tsx` (full value in title/aria, copy
flash), `countdown.tsx` (mount-gated dd:hh:mm:ss), `reveal.tsx`
(once-only, reduced-motion-aware), mandate surfaces in `components/mandate/*`
(authority header, constraint ledger, aqua balances, simulation gate, flow
trace, revocation console, receipt plate, strategy fields, fail-closed
unknown route).

## Motion

One authored moment per section; exponential ease-out (`--ease-out-expo`,
`--ease-out-quart`); crossfades masked with 5px blur; scroll-driven (Motion
`useScroll`), never time-jacked; UI transitions ≤300ms; transform/opacity +
blur only; `prefers-reduced-motion` collapses pinning and entrances to static.

## Honest-state rules

`SAMPLE — synthetic demo state` labels all demo data; revocation flips the
whole page (header, ledger rows, gate, trace); submitted ≠ confirmed;
unknown fails closed on the unknown-hash route. Countdown replaced by
"stopped by owner" when revoked.
