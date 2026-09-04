import { BadgeCheck } from "lucide-react";
import { CopyValue } from "@/components/ui/copy-value";
import { Countdown } from "@/components/ui/countdown";
import { Stamp } from "@/components/ui/kit";
import { CHAIN, DEMO, type StampKind } from "@/lib/demo";

/**
 * Authority header — the ten-second answer: who may act, until when,
 * under what verification, and what they may do.
 */
export function AuthorityHeader({
  status = "ACTIVE",
  sentence,
  compact = false,
}: {
  status?: StampKind;
  sentence?: string;
  compact?: boolean;
}) {
  return (
    <header className={`grid gap-6 border-b border-rule pb-8 md:grid-cols-[1fr_auto] ${compact ? "pb-6" : ""}`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <Stamp kind={status} />
          {status === "REVOKED" || status === "FAILED" ? (
            <span className="mono-data font-medium" style={{ color: "var(--revoked)" }}>
              stopped by owner: execution reverts
            </span>
          ) : (
            <span className="mono-data text-ink-3">
              expires in{" "}
              <Countdown until={DEMO.policy.validUntil} className="font-medium text-ink" />
            </span>
          )}
        </div>
        <h2 className="mt-3 truncate text-[1.375rem] font-medium tracking-[-0.015em]">
          {DEMO.agent.ens}
        </h2>
        <div className="mono-data mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-ink-2">
          <CopyValue value={DEMO.agent.address} />
          <span className="text-ink-3" aria-hidden="true">
            ·
          </span>
          <span>{CHAIN.name}</span>
          <span className="text-ink-3" aria-hidden="true">
            ·
          </span>
          <span className="text-ink-2">
            verified at block{" "}
            <span className="text-ink">{DEMO.identity.verifiedAtBlock.toLocaleString("en-US")}</span>
          </span>
        </div>
        {sentence && (
          <p className="mt-4 flex max-w-[64ch] items-start gap-2 text-[0.9375rem] leading-relaxed text-ink-2">
            <BadgeCheck size={16} strokeWidth={2.25} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
            {sentence}
          </p>
        )}
      </div>
      <div className="mono-data self-end text-right text-ink-3 max-md:self-start max-md:text-left">
        <div className="ledger-label">Strategy</div>
        <CopyValue value={DEMO.strategyHash} display="0x4a91…0b5d" className="mt-1 justify-end max-md:justify-start" />
      </div>
    </header>
  );
}
