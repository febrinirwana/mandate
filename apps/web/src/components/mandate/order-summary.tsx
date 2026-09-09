import type { MandateSnapshotV1 } from "@mandate/domain";

import { CopyValue } from "@/components/ui/copy-value";
import { Stamp } from "@/components/ui/kit";
import { inspectionStatus, remainingInput } from "@/lib/mandate";

export function OrderSummary({ snapshot }: { snapshot: MandateSnapshotV1 }) {
  const remaining = remainingInput(snapshot);
  const status = inspectionStatus(snapshot);
  const total = BigInt(snapshot.strategy.maxInputTotal);
  const used = BigInt(snapshot.state.usedInput);
  const usedPercent = total === 0n ? 0n : (used * 100n) / total;

  return (
    <aside className="border border-rule bg-raised p-6" aria-label="Mandate summary">
      <div className="flex items-center justify-between gap-4 border-b border-rule pb-4">
        <span className="ledger-label text-ink-3">The order at a glance</span>
        <Stamp
          kind={status === "ACTIVE" ? "ACTIVE" : status === "UNKNOWN" ? "UNKNOWN" : "FAILED"}
          label={status}
        />
      </div>
      <dl className="mt-2">
        <div className="border-b border-rule py-4">
          <dt className="ledger-label text-ink-3">Who may act</dt>
          <dd className="mono-data mt-1 break-all font-medium">{snapshot.strategy.agent}</dd>
        </div>
        <div className="border-b border-rule py-4">
          <dt className="ledger-label text-ink-3">What can move</dt>
          <dd className="mono-data mt-1 break-all">
            {snapshot.strategy.tokenIn} → {snapshot.strategy.tokenOut}
          </dd>
        </div>
        <div className="border-b border-rule py-4">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="ledger-label text-ink-3">Remaining cap</dt>
            <dd className="mono-data text-right font-medium">{remaining} base units</dd>
          </div>
          <div
            className="mt-2.5 h-[6px] w-full bg-recess"
            role="img"
            aria-label={`${usedPercent}% of total cap used`}
          >
            <div className="h-full bg-accent" style={{ width: `${usedPercent}%` }} />
          </div>
        </div>
        <div className="border-b border-rule py-4">
          <dt className="ledger-label text-ink-3">Expires</dt>
          <dd className="mono-data mt-1">unix {snapshot.strategy.validUntil}</dd>
        </div>
        <div className="pt-4">
          <dt className="ledger-label text-ink-3">Revoke path</dt>
          <dd className="mono-data mt-1">owner calls MandateAquaApp.revoke(strategyHash)</dd>
        </div>
        <div className="pt-4">
          <dt className="ledger-label text-ink-3">Strategy</dt>
          <dd className="mt-2">
            <CopyValue value={snapshot.strategyHash} className="font-medium text-ink" />
          </dd>
        </div>
      </dl>
    </aside>
  );
}
