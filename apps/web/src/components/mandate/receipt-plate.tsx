import type { ExecutionV1, MandateSnapshotV1, ReceiptAuditV1 } from "@mandate/domain";

import { CopyValue } from "@/components/ui/copy-value";
import { Stamp } from "@/components/ui/kit";

export function ReceiptPlate({
  snapshot,
  execution,
  audit,
  transactionState,
}: {
  snapshot: MandateSnapshotV1;
  execution?: ExecutionV1;
  audit?: ReceiptAuditV1;
  transactionState?: "SUBMITTED" | "REVERTED" | "REORGED";
}) {
  const status = execution?.status ?? transactionState ?? "AWAITING";
  const confirmed = execution?.status === "CONFIRMED" && audit?.result === "COMPLIANT";
  const auditLabel = audit?.result ?? "UNKNOWN";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-3">
        <h3 className="text-[1.0625rem] font-medium tracking-[-0.01em]">Receipt</h3>
        <Stamp
          kind={
            confirmed
              ? "CONFIRMED"
              : status === "SUBMITTED"
                ? "EXPIRING"
                : status === "REORGED"
                  ? "UNKNOWN"
                  : status === "REVERTED"
                    ? "FAILED"
                    : "UNKNOWN"
          }
          label={confirmed ? "CONFIRMED" : status}
        />
      </div>
      {execution ? (
        <dl className="mt-4 grid gap-x-10 md:grid-cols-2">
          <Row label="Transaction">
            <CopyValue value={execution.txHash} />
          </Row>
          <Row label="Execution state">{execution.status}</Row>
          <Row label="Block">{execution.block.number}</Row>
          <Row label="Caller">
            <CopyValue value={execution.caller} />
          </Row>
          <Row label="Input">{execution.amountIn} base units</Row>
          <Row label="Output">{execution.amountOut} base units</Row>
          <Row label="Used after">{execution.usedInputAfter} base units</Row>
          <Row label="Audit">{auditLabel}</Row>
        </dl>
      ) : (
        <p className="mono-data mt-4 text-ink-2">
          {status === "SUBMITTED"
            ? "SUBMITTED: waiting for a canonical receipt. Submitted is not confirmed."
            : "No canonical MandateExecuted receipt has been loaded for this strategy."}
        </p>
      )}
      <p className="mono-data mt-5 border-t border-rule pt-4 text-ink-3">
        Audit compares receipt events and block-bound evidence to strategy {snapshot.strategyHash}.
        Reorged, reverted, or missing evidence never becomes compliant.
      </p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-rule py-2.5">
      <dt className="ledger-label shrink-0 text-ink-3">{label}</dt>
      <dd className="mono-data flex items-center text-right text-ink">{children}</dd>
    </div>
  );
}
