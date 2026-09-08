import type { MandateSnapshotV1 } from "@mandate/domain";
import { ChevronDown } from "lucide-react";

import { CopyValue } from "@/components/ui/copy-value";

const FIELDS = [
  "maker",
  "agent",
  "ensRegistry",
  "ensResolver",
  "ensLabel",
  "ensNode",
  "tokenIn",
  "tokenOut",
  "swapTarget",
  "swapSelector",
  "minRateNumerator",
  "minRateDenominator",
  "maxInputPerCall",
  "maxInputTotal",
  "validAfter",
  "validUntil",
  "salt",
] as const;

export function StrategyFields({ snapshot }: { snapshot: MandateSnapshotV1 }) {
  return (
    <details className="group border-t border-rule">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between py-4 [&::-webkit-details-marker]:hidden">
        <span className="text-[0.9375rem] font-medium">Exact StrategyV1 ABI fields</span>
        <span className="mono-data flex items-center gap-2 text-ink-3">
          hash = keccak256(abi.encode(Strategy))
          <ChevronDown size={14} strokeWidth={2} className="transition-transform duration-300 group-open:rotate-180" aria-hidden="true" />
        </span>
      </summary>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse">
          <tbody>
            {FIELDS.map((field) => (
              <tr key={field} className="border-b border-rule last:border-b-0">
                <th scope="row" className="mono-data py-2 pr-6 text-left font-normal text-ink-2">{field}</th>
                <td className="mono-data py-2 text-ink"><span className="block break-all">{snapshot.strategy[field]}</span></td>
              </tr>
            ))}
            <tr className="bg-recess">
              <th scope="row" className="mono-data py-2 pr-6 text-left font-medium">strategyHash</th>
              <td className="mono-data py-2 font-medium" style={{ color: "var(--accent)" }}><CopyValue value={snapshot.strategyHash} /></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mono-data mt-3 text-ink-3">Immutable field changes require a new strategy hash. This is the exact ABI state active at the stamped block.</p>
    </details>
  );
}
