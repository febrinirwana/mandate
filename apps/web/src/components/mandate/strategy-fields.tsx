import { ChevronDown } from "lucide-react";
import { DEMO } from "@/lib/demo";

const TOKEN_IN = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
const TOKEN_OUT = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B36";

const FIELDS: [string, string][] = [
  ["maker", DEMO.maker.address],
  ["agent", DEMO.agent.address],
  ["ensRegistry", DEMO.identity.registry],
  ["ensResolver", DEMO.identity.resolver],
  ["ensLabel", `"${DEMO.identity.label}"`],
  ["ensNode", DEMO.identity.node],
  ["tokenIn", TOKEN_IN],
  ["tokenOut", TOKEN_OUT],
  ["swapTarget", DEMO.venue.target],
  ["swapSelector", DEMO.venue.selector],
  ["minRateNumerator", "7"],
  ["minRateDenominator", "20,000"],
  ["maxInputPerCall", "1,000,000,000"],
  ["maxInputTotal", "5,000,000,000"],
  ["validAfter", "1_788_579_600 (2026-09-04 00:00 UTC)"],
  ["validUntil", "1_791_168_000 (2026-10-04 00:00 UTC)"],
  ["salt", DEMO.policy.salt],
];

/**
 * Exact strategy fields — the machine truth beside every human summary.
 * Immutable: parameter changes require revoke + a new strategy.
 */
export function StrategyFields() {
  return (
    <details className="group border-t border-rule">
      <summary className="flex cursor-pointer list-none items-center justify-between py-4 [&::-webkit-details-marker]:hidden">
        <span className="text-[0.9375rem] font-medium">Exact strategy fields</span>
        <span className="mono-data flex items-center gap-2 text-ink-3">
          hash = keccak256(abi.encode(Strategy))
          <ChevronDown size={14} strokeWidth={2} className="transition-transform duration-300 group-open:rotate-180" aria-hidden="true" />
        </span>
      </summary>
      <table className="w-full min-w-[560px] border-collapse">
        <tbody>
          {FIELDS.map(([name, value]) => (
            <tr key={name} className="border-b border-rule last:border-b-0">
              <th scope="row" className="mono-data py-2 pr-6 text-left font-normal text-ink-2">
                {name}
              </th>
              <td className="mono-data py-2 text-ink">
                <span className="block break-all">{value}</span>
              </td>
            </tr>
          ))}
          <tr className="bg-recess">
            <th scope="row" className="mono-data py-2 pr-6 text-left font-medium">
              strategyHash
            </th>
            <td className="mono-data py-2 font-medium" style={{ color: "var(--accent)" }}>
              <span className="block break-all">{DEMO.strategyHash}</span>
            </td>
          </tr>
        </tbody>
      </table>
      <p className="mono-data mt-3 text-ink-3">
        One hash everywhere: shipped to Aqua, activated in Mandate, checked at execution, stamped on
        receipts.
      </p>
    </details>
  );
}
