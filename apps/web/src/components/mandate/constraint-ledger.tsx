import type { MandateSnapshotV1 } from "@mandate/domain";

import { Stamp } from "@/components/ui/kit";
import { inspectionStatus, remainingInput } from "@/lib/mandate";

type Row = { constraint: string; approved: string; effective: string; detail: string };

export function ConstraintLedger({ snapshot }: { snapshot: MandateSnapshotV1 }) {
  const status = inspectionStatus(snapshot);
  const rows: Row[] = [
    {
      constraint: "Per execution",
      approved: `${snapshot.strategy.maxInputPerCall} base units`,
      effective: status === "ACTIVE" ? "enforced onchain" : "not executable",
      detail: "maxInputPerCall",
    },
    {
      constraint: "Total budget",
      approved: `${snapshot.strategy.maxInputTotal} base units`,
      effective: `${remainingInput(snapshot)} base units remaining`,
      detail: `${snapshot.state.usedInput} usedInput at block ${snapshot.block.number}`,
    },
    {
      constraint: "Minimum output",
      approved: `ceil(input × ${snapshot.strategy.minRateNumerator} ÷ ${snapshot.strategy.minRateDenominator})`,
      effective: "contract checks actual balance delta",
      detail: "base-unit rate floor",
    },
    {
      constraint: "Route",
      approved: `${snapshot.strategy.swapTarget} · ${snapshot.strategy.swapSelector}`,
      effective: "fixed target and selector",
      detail: "agent cannot choose a different call surface",
    },
    {
      constraint: "Recipient",
      approved: snapshot.strategy.maker,
      effective: "Aqua pushes output to maker",
      detail: "agent has no redirectable recipient",
    },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left">
        <thead className="border-y border-rule">
          <tr className="ledger-label text-ink-3">
            <th className="py-3 pr-5 font-medium">Constraint</th>
            <th className="py-3 pr-5 font-medium">Approved</th>
            <th className="py-3 pr-5 font-medium">Effective now</th>
            <th className="py-3 text-right font-medium">State</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.constraint} className="border-b border-rule align-top">
              <th scope="row" className="py-4 pr-5 text-[0.9375rem] font-medium">{row.constraint}</th>
              <td className="mono-data max-w-[22rem] break-all py-4 pr-5">{row.approved}</td>
              <td className="mono-data max-w-[22rem] break-all py-4 pr-5 text-ink-2">
                {row.effective}<span className="mt-1 block text-ink-3">{row.detail}</span>
              </td>
              <td className="py-4 text-right">
                <Stamp kind={status === "ACTIVE" ? "PASS" : status === "UNKNOWN" ? "UNKNOWN" : "FAILED"} label={status === "ACTIVE" ? "ENFORCED" : status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
