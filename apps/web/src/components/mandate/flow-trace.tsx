import type { ExecutionV1, MandateSnapshotV1 } from "@mandate/domain";

import { Stamp } from "@/components/ui/kit";

const STEPS = [
  "Agent call",
  "ENS check",
  "Mandate check",
  "Aqua pull",
  "Fixed swap",
  "Aqua push",
] as const;

export function FlowTrace({
  snapshot,
  execution,
}: {
  snapshot: MandateSnapshotV1;
  execution?: ExecutionV1;
}) {
  const confirmed = execution?.status === "CONFIRMED";
  const reorged = execution?.status === "REORGED";
  const blocked = snapshot.state.revoked || snapshot.result !== "PASS";

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-rule pb-3">
        <h3 className="text-[1.0625rem] font-medium tracking-[-0.01em]">Flow trace</h3>
        <Stamp
          kind={confirmed ? "CONFIRMED" : reorged ? "UNKNOWN" : blocked ? "FAILED" : "UNKNOWN"}
          label={
            confirmed
              ? "RECONSTRUCTED"
              : reorged
                ? "REORGED"
                : blocked
                  ? "BLOCKED"
                  : "AWAITING RECEIPT"
          }
        />
      </div>
      <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {STEPS.map((step, index) => (
          <li key={step} className="flex min-h-11 items-center gap-3 border-b border-rule py-2">
            <span className="mono-data grid h-6 w-6 shrink-0 place-items-center rounded-full border border-rule">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="text-[0.875rem]">{step}</span>
          </li>
        ))}
      </ol>
      <p className="mono-data mt-4 text-ink-2">
        {confirmed
          ? `Confirmed execution ${execution.txHash}: ${execution.amountIn} input → ${execution.amountOut} output.`
          : reorged
            ? "REORGED: prior receipt is not canonical. Do not treat it as compliant."
            : blocked
              ? "Execution currently fails closed under the stamped state."
              : "Trace is an execution plan until a canonical receipt reconstructs it."}
      </p>
    </div>
  );
}
