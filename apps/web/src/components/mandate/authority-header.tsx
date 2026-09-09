import type { MandateSnapshotV1 } from "@mandate/domain";
import { BadgeCheck } from "lucide-react";

import { CopyValue } from "@/components/ui/copy-value";
import { Stamp } from "@/components/ui/kit";
import { CHAIN, DEMO, type StampKind } from "@/lib/demo";
import { inspectionStatus, type InspectionStatus } from "@/lib/mandate";

function stampFor(status: InspectionStatus): StampKind {
  if (status === "REVOKED") return "REVOKED";
  if (status === "UNKNOWN") return "UNKNOWN";
  return "FAILED";
}

export function AuthorityHeader({
  snapshot,
  sentence,
  compact = false,
}: {
  snapshot?: MandateSnapshotV1;
  sentence?: string;
  compact?: boolean;
}) {
  const status = snapshot ? inspectionStatus(snapshot) : "ACTIVE";
  const agent = snapshot?.strategy.agent ?? DEMO.agent.address;
  const label = snapshot?.strategy.ensLabel ?? DEMO.agent.ens;
  const chain = snapshot?.chainId ?? CHAIN.name;
  const block = snapshot?.block.number ?? DEMO.identity.verifiedAtBlock.toString();
  const strategyHash = snapshot?.strategyHash ?? DEMO.strategyHash;

  return (
    <header
      className={`grid grid-cols-[minmax(0,1fr)] gap-6 border-b border-rule pb-8 md:grid-cols-[minmax(0,1fr)_auto] ${compact ? "pb-6" : ""}`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <Stamp kind={stampFor(status)} label={status} />
          <span className="mono-data text-ink-3">
            {status === "REVOKED"
              ? "stopped by owner: execution reverts"
              : status === "UNKNOWN"
                ? "chain truth unavailable: execution status unknown"
                : `block-stamped at ${block}`}
          </span>
        </div>
        <h2 className="mt-3 break-all text-[1.375rem] font-medium tracking-[-0.015em]">{label}</h2>
        <div className="mono-data mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-ink-2">
          <CopyValue value={agent} />
          <span className="text-ink-3" aria-hidden="true">
            ·
          </span>
          <span>chain {chain}</span>
          <span className="text-ink-3" aria-hidden="true">
            ·
          </span>
          <span>agent may act only through the immutable strategy</span>
        </div>
        {sentence && (
          <p className="mt-4 flex max-w-[64ch] items-start gap-2 text-[0.9375rem] leading-relaxed text-ink-2">
            <BadgeCheck
              size={16}
              strokeWidth={2.25}
              className="mt-0.5 shrink-0 text-accent"
              aria-hidden="true"
            />
            {sentence}
          </p>
        )}
      </div>
      <div className="mono-data min-w-0 max-w-full self-end text-right text-ink-3 max-md:self-start max-md:text-left">
        <div className="ledger-label">Strategy</div>
        <CopyValue value={strategyHash} className="mt-1 justify-end max-md:justify-start" />
      </div>
    </header>
  );
}
