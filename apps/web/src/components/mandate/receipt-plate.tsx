import type {
  ExecutionV1,
  MandateSnapshotV1,
  PolicyProfileV1,
  ReceiptAuditV1,
} from "@mandate/domain";

import { CopyValue } from "@/components/ui/copy-value";
import { Stamp } from "@/components/ui/kit";
import { formatTokenAmount } from "@/lib/token-display";

export function ReceiptPlate({
  snapshot,
  execution,
  audit,
  transactionState,
  profile,
}: {
  snapshot: MandateSnapshotV1;
  execution?: ExecutionV1;
  audit?: ReceiptAuditV1;
  transactionState?: "SUBMITTED" | "REVERTED" | "REORGED";
  profile?: PolicyProfileV1;
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
        <dl className="mt-4 grid min-w-0 gap-x-10 md:grid-cols-2">
          <Row label="Transaction" className="min-w-0 md:col-span-2">
            <CopyValue value={execution.txHash} className="w-full justify-end" />
          </Row>
          <Row label="Execution state">{execution.status}</Row>
          <Row label="Block">{execution.block.number}</Row>
          <Row label="Caller">
            <CopyValue value={execution.caller} />
          </Row>
          <Row label="Input">
            {profile
              ? formatTokenAmount(execution.amountIn, profile.tokenIn)
              : `${execution.amountIn} base units`}
          </Row>
          <Row label="Output">
            {profile
              ? formatTokenAmount(execution.amountOut, profile.tokenOut)
              : `${execution.amountOut} base units`}
          </Row>
          <Row label="Used after">
            {profile
              ? formatTokenAmount(execution.usedInputAfter, profile.tokenIn)
              : `${execution.usedInputAfter} base units`}
          </Row>
          <Row label="Audit">{auditLabel}</Row>
        </dl>
      ) : (
        <p className="mono-data mt-4 text-ink-2">
          {status === "SUBMITTED"
            ? "SUBMITTED: Sepolia accepted the transaction. The receipt becomes canonical only when its block hash still matches the chain’s current block at that height."
            : "No MandateExecuted event exists yet. A receipt comes from the Sepolia transaction emitted after the constrained agent successfully calls MandateAquaApp.execute."}
        </p>
      )}
      <p className="mono-data mt-5 border-t border-rule pt-4 text-ink-3">
        Audit compares receipt events and block-bound evidence to strategy {snapshot.strategyHash}.
        Reorged, reverted, or missing evidence never becomes compliant.
      </p>
    </div>
  );
}

function Row({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex min-w-0 items-baseline justify-between gap-4 border-b border-rule py-2.5 ${className ?? ""}`}
    >
      <dt className="ledger-label shrink-0 text-ink-3">{label}</dt>
      <dd className="mono-data flex min-w-0 items-center text-right text-ink">{children}</dd>
    </div>
  );
}
