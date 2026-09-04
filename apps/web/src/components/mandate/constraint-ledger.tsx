import { minOutput, TOKENS } from "@/lib/demo";
import { Stamp } from "@/components/ui/kit";

type Row = {
  constraint: string;
  approved: string;
  current: string;
  detail?: string;
};

const ROWS: Row[] = [
  {
    constraint: "Per execution",
    approved: "≤ 1,000 USDC",
    current: "requesting 500 USDC",
    detail: "1,000,000,000 base units (6 dec)",
  },
  {
    constraint: "Total budget",
    approved: "≤ 5,000 USDC",
    current: "1,250 used · 3,750 remaining",
    detail: "5,000,000,000 base units lifetime",
  },
  {
    constraint: "Minimum output",
    approved: `≥ ${minOutput(1_000_000_000, 6, 18, 7, 20_000).toFixed(6)} WETH / 1,000 USDC`,
    current: "route quote clears the floor",
    detail: "ceil(amountIn × 7 ÷ 20000), base units",
  },
  {
    constraint: "Route",
    approved: "Router v6 · 0x12aa3caf",
    current: "decoded calldata matches",
    detail: "fixed target + selector, owner-set",
  },
  {
    constraint: "Recipient",
    approved: "treasury only",
    current: "Aqua push to maker",
    detail: "agent cannot redirect output",
  },
];

/**
 * Constraint ledger — one semantic table: what was approved, what is
 * currently effective, and whether each still holds.
 */
export function ConstraintLedger({ stopped = false }: { stopped?: boolean }) {
  return (
    <div>
      <div className="flex items-baseline justify-between border-b border-rule pb-3">
        <h3 className="text-[1.0625rem] font-medium tracking-[-0.01em]">Constraint ledger</h3>
        <span className="ledger-label text-ink-3">approved · current · result</span>
      </div>
      <table className="w-full min-w-[560px] border-collapse">
        <thead>
          <tr className="border-b border-rule text-left">
            <th scope="col" className="ledger-label py-2.5 pr-4 font-medium text-ink-3">Constraint</th>
            <th scope="col" className="ledger-label py-2.5 pr-4 font-medium text-ink-3">Approved</th>
            <th scope="col" className="ledger-label py-2.5 pr-4 font-medium text-ink-3">Current</th>
            <th scope="col" className="ledger-label py-2.5 text-right font-medium text-ink-3">Result</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => (
            <tr key={r.constraint} className="group border-b border-rule transition-colors hover:bg-accent-ghost">
              <th scope="row" className="py-3 pr-4 text-left text-[0.9375rem] font-normal">{r.constraint}</th>
              <td className="mono-data py-3 pr-4 text-ink" title={r.detail}>{r.approved}</td>
              <td className="mono-data py-3 pr-4 text-ink-2">
                {stopped ? "no execution possible" : r.current}
              </td>
              <td className="py-3 text-right">
                <Stamp kind={stopped ? "FAILED" : "PASS"} label={stopped ? "FAIL" : "PASS"} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mono-data mt-3 text-ink-3">
        Display units shown; base units on hover. Policy math is integer-only: {TOKENS.in.symbol} 6 dec,{" "}
        {TOKENS.out.symbol} 18 dec.
      </p>
    </div>
  );
}
