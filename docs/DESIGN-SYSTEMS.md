# Mandate Design System

**Design objective:** Make delegated financial authority readable in ten seconds and auditable in ten minutes.

## 1. Brand foundation

The visual system is an **Authority Ledger**: a signed operating order translated into live onchain state.

- **Precise, not sterile:** editorial spacing and strong typography; no enterprise dashboard sludge.
- **Financial, not speculative:** ivory paper, carbon ink, cobalt authorization, vermilion revocation.
- **State-first:** active, expiring, revoked, unknown, simulated, and executed always have distinct language.
- **Identity-bound:** agent name never appears without full address and current verification state.

The product name is `Mandate` in prose and `MANDATE` only in compact wordmark or ledger stamps. Until a canonical logo is supplied, use a typeset wordmark; do not invent an icon.

## 2. Visual anti-patterns

Never use:

- neon gradients, glassmorphism, glowing chains, token confetti, or candlestick wallpaper;
- pill soup, soft cards floating in empty space, or an admin sidebar for the primary flow;
- green for “simulated” or “submitted”; green is reserved for confirmed compliant execution;
- truncated strategy hashes/addresses without accessible full values and copy actions;
- animated money movement that implies settlement before confirmation.

## 3. Color tokens

```css
:root {
  --mandate-paper: #f3efe5;
  --mandate-paper-raised: #fbf9f3;
  --mandate-carbon: #151719;
  --mandate-ink: #292d31;
  --mandate-muted: #676d72;
  --mandate-rule: #c9c4b8;
  --mandate-cobalt: #174ea6;
  --mandate-cobalt-dark: #103875;
  --mandate-cobalt-soft: #dce8fb;
  --mandate-confirmed: #17653a;
  --mandate-warning: #8a5a00;
  --mandate-revoked: #b4372f;
  --mandate-unknown: #66558c;
  --mandate-focus: #0b65d8;
}
```

| State | Color | Required label |
|---|---|---|
| Active authority | cobalt | `ACTIVE` |
| Simulation pass | cobalt | `PASS — SIMULATION ONLY` |
| Confirmed execution | confirmed green | `CONFIRMED` |
| Expiring soon | warning ochre | `EXPIRING` |
| Revoked/failed | vermilion | `REVOKED` / `FAILED` |
| Missing/uncertain | violet | `UNKNOWN` |

Color never carries status alone. Add icon and exact text.

## 4. Typography

- **Display and interface:** `Geist Sans`, bundled locally through `next/font/local` or package assets.
- **Amounts, addresses, hashes, reason codes:** `Geist Mono` with tabular numerals.
- **Document voice:** short declarative labels; sentence case for explanations; uppercase only for state stamps.

| Style | Desktop | Mobile | Weight | Line height |
|---|---:|---:|---:|---:|
| Landing thesis | 88px | 46px | 560 | .94 |
| Product H1 | 52px | 36px | 600 | 1.0 |
| Section H2 | 28px | 24px | 600 | 1.1 |
| Body | 16px | 15px | 420 | 1.55 |
| Ledger label | 12px | 12px | 600 | 1.35 |
| Evidence/code | 13px | 12px | 450 | 1.45 |

## 5. Spacing and form

Base unit: 4px. Scale: `4, 8, 12, 16, 24, 32, 48, 64, 96`.

- Reading width: 1080px; execution console: 1320px.
- Rules are 1px; section boundaries may use 2px carbon rules.
- Corners: 0–6px. Ledger rows are square; controls may use 4px.
- Minimum target: 44px.
- Shadows: one subtle paper lift only for blocking dialogs; no stacked cards.
- Dense data uses aligned rows and columns, not separate cards.

## 6. Information architecture

### Public routes

`/` thesis and live demo entry  
`/mandates/new` owner issuance flow  
`/mandates/[strategyHash]` public authority inspection  
`/mandates/[strategyHash]/simulate` agent simulation console  
`/executions/[chainId]/[txHash]` canonical receipt and audit

### Inspection hierarchy

1. status and stop availability;
2. treasury owner and agent identity;
3. one-sentence authority;
4. pair, venue, rate floor, caps, used/remaining, and time window;
5. Aqua physical/virtual balances;
6. latest simulation/execution;
7. exact strategy fields and hash;
8. events, blocks, addresses, and limitations.

## 7. Core components

### 7.1 Authority Header

```text
ACTIVE                     expires in 05:42:18
market-maker.<treasury>.eth
0xAgent…                     Sepolia · verified at block 7,654,321
May convert USDC → WETH through [fixed venue]
```

Show full address in accessible name and copy affordance. If ENS cannot be verified, replace `ACTIVE` with `UNKNOWN` even if cached UI data says active.

### 7.2 Constraint Ledger

One semantic table:

| Constraint | Approved | Current | Result |
|---|---:|---:|---|
| Per execution | 1,000 USDC | 500 USDC | PASS |
| Total budget | 5,000 USDC | 1,500 used / 3,500 remaining | PASS |
| Minimum output | exact base-unit ratio | route quote | PASS |
| Route | target + selector | decoded transaction | PASS |
| Recipient | treasury only | treasury | PASS |

Each display amount exposes base units and decimals in a disclosure.

### 7.3 Simulation Gate

Three columns: `Identity`, `Policy`, `Settlement`. Each row has check, source, block, and reason. Primary action label: `Submit as agent`, never `Approve`. Banner: “Simulation is advisory. The contract repeats every check.”

### 7.4 Flow Trace

A six-step horizontal/vertical trace:

`Agent call -> ENS check -> mandate check -> Aqua pull -> fixed swap -> Aqua push`

Before execution it is an estimate. After confirmation it is reconstructed from events/balances. Labels must make that distinction.

### 7.5 Revocation Console

Always-visible owner-only section with three rows:

- Revoke Mandate — immediate app stop, irreversible for this hash.
- Dock Aqua strategy — clears all listed virtual balances.
- Revoke/expire ENS identity — invalidates identity; may affect other uses of the name.

Each confirmation repeats agent name, strategy hash, and consequence. Never combine all three into one unexplained transaction.

### 7.6 Receipt Plate

Show status, transaction hash, confirmed block/hash, caller, strategy hash, actual input/output, rate, cumulative budget, Aqua events, Mandate event, token balance deltas, and audit status. `Submitted` is not `Confirmed`.

## 8. Issuance workflow

Four steps only:

1. **Identity** — select/register subname, generate/connect dedicated signer, verify current state.
2. **Authority** — pair, venue, minimum rate, per-call/total caps, window.
3. **Review** — plain-language sentence beside exact ABI table and transaction list.
4. **Sign setup** — ENS, approvals, Aqua ship, Mandate activation with individual receipt states.

Preserve values when a wallet rejects. Do not advance on submission; wait for configured confirmation depth.

## 9. Responsive behavior

- Above 1100px: authority header and constraint ledger share a 5/7 grid; evidence spans full width.
- 700–1099px: single content column; constraint table remains table where it fits.
- Below 700px: each constraint becomes a semantic definition row; status and amount stay adjacent.
- At 375px, full hashes wrap or horizontal-scroll inside labeled code regions; the page itself never scrolls horizontally.
- Persistent mobile action bar may show `Simulate` or `Revoke`, never both for the wrong connected role.

## 10. Motion

Motion communicates state transition, not spectacle.

- CSS: hover, focus, disclosure, progress, and status color transitions under 180ms.
- Motion: layout transitions between simulation checks and receipt trace; opacity/transform only.
- GSAP: not installed in runtime initially. Use only if the final demo requires one coordinated ledger-to-receipt sequence that cannot be expressed cleanly with Motion.
- Reduced motion: remove spatial travel and continuous countdown animation; update text discretely.
- Wallet submission never animates into success until confirmed receipt exists.

## 11. Copy contract

Use:

- “Agent is authorized to…”
- “Treasury tokens remain in the owner wallet between executions.”
- “Simulation passed at block N; execution will re-check.”
- “Output must be at least X base units.”
- “Revoked by owner at block N.”

Never use:

- “safe,” “risk-free,” “AI verified,” “guaranteed best price,” “gasless” without proof;
- “ENS authenticated” without naming registry state checked;
- “Aqua protects funds” without naming app limits;
- “approved” for simulation;
- “executed” for submitted transaction.

## 12. Accessibility contract

- WCAG 2.2 AA for text, controls, focus, and semantic status.
- Logical heading sequence and landmarks.
- Native tables/definition lists; chartless core flow.
- Every icon has visible adjacent text or accessible label.
- Error summary links to invalid field and preserves input.
- Countdown includes absolute UTC expiry.
- Full addresses/hashes are available to assistive technology.
- Wallet and route errors are rewritten in plain language while preserving raw details in a disclosure.

## 13. Empty, loading, and failure states

- No mandate: explain owner/agent separation and offer `Issue a mandate`.
- Loading: show labeled skeleton rows, never a green cached status.
- RPC outage: `UNKNOWN — current onchain state unavailable` and last verified block/time.
- ENS mismatch: show expected and observed address/owner.
- Simulation stale: disable submit and provide `Run again`.
- Wallet rejection: keep draft; state that no transaction was sent.
- External route revert: no success trace; show atomic rollback and unchanged confirmed balances after refresh.
