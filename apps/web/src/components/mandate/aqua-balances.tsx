import { TOKENS } from "@/lib/demo";

const PHYSICAL = [
  { label: `${TOKENS.in.symbol} in treasury wallet`, value: "4,268.02" },
  { label: `${TOKENS.out.symbol} in treasury wallet`, value: "1.884117" },
  { label: `${TOKENS.in.symbol} at agent`, value: "0.00" },
];

const VIRTUAL = [
  { label: `${TOKENS.in.symbol} allowance left (Aqua)`, value: "3,750.00" },
  { label: `${TOKENS.out.symbol} accumulated via strategy`, value: "0.611298" },
];

/**
 * Aqua balances — physical custody vs the strategy's virtual allowance lane.
 * Two different ledgers; the distinction is the product.
 */
export function AquaBalances() {
  return (
    <div>
      <div className="flex items-baseline justify-between border-b border-rule pb-3">
        <h3 className="text-[1.0625rem] font-medium tracking-[-0.01em]">Aqua balances</h3>
        <span className="ledger-label text-ink-3">physical vs virtual</span>
      </div>
      <div className="mt-4 grid gap-8 md:grid-cols-2">
        <dl>
          <dt className="ledger-label text-ink-3">Physical: maker wallet</dt>
          {PHYSICAL.map((r) => (
            <div key={r.label} className="flex items-baseline justify-between gap-6 border-b border-rule py-2.5">
              <dd className="text-[0.875rem] text-ink-2">{r.label}</dd>
              <dd className="mono-data text-ink">{r.value}</dd>
            </div>
          ))}
        </dl>
        <dl>
          <dt className="ledger-label text-ink-3">Virtual: Aqua strategy lane</dt>
          {VIRTUAL.map((r) => (
            <div key={r.label} className="flex items-baseline justify-between gap-6 border-b border-rule py-2.5">
              <dd className="text-[0.875rem] text-ink-2">{r.label}</dd>
              <dd className="mono-data text-ink">{r.value}</dd>
            </div>
          ))}
          <p className="mono-data mt-3 text-ink-3">
            Virtual balances are per-maker/app/strategy accounting lanes at Aqua, never a second token
            balance. Physical tokens stay in the treasury wallet between executions.
          </p>
        </dl>
      </div>
    </div>
  );
}
