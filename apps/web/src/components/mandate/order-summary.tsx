import { CopyValue } from "@/components/ui/copy-value";
import { Stamp } from "@/components/ui/kit";
import { DEMO } from "@/lib/demo";

/**
 * The ten-second answer, as a card: caps with live progress, window, venue,
 * output rule, and the strategy hash. Everything else on the page is detail
 * beneath this summary.
 */
export function OrderSummary({ stopped = false }: { stopped?: boolean }) {
  const perExecPct = Math.min(100, (500 / 1000) * 100);
  const budgetPct = Math.min(100, (1250 / 5000) * 100);

  return (
    <aside className="border border-rule bg-raised p-6" aria-label="Mandate summary">
      <div className="flex items-center justify-between gap-4 border-b border-rule pb-4">
        <span className="ledger-label text-ink-3">The order at a glance</span>
        <Stamp kind={stopped ? "REVOKED" : "ACTIVE"} />
      </div>

      <dl className="mt-2">
        <div className="border-b border-rule py-4">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="ledger-label text-ink-3">Per execution</dt>
            <dd className="mono-data font-medium text-ink">500 / 1,000 USDC</dd>
          </div>
          <div className="mt-2.5 h-[6px] w-full bg-recess" role="img" aria-label="Half of the per-execution cap used">
            <div className="h-full transition-all duration-700" style={{ width: `${perExecPct}%`, background: stopped ? "var(--revoked)" : "var(--accent)" }} />
          </div>
        </div>
        <div className="border-b border-rule py-4">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="ledger-label text-ink-3">Total budget</dt>
            <dd className="mono-data font-medium text-ink">1,250 / 5,000 USDC</dd>
          </div>
          <div className="mt-2.5 h-[6px] w-full bg-recess" role="img" aria-label="A quarter of the lifetime budget used">
            <div className="h-full transition-all duration-700" style={{ width: `${budgetPct}%`, background: stopped ? "var(--revoked)" : "var(--accent)" }} />
          </div>
        </div>
        <div className="flex items-baseline justify-between gap-4 border-b border-rule py-4">
          <dt className="ledger-label shrink-0 text-ink-3">Output</dt>
          <dd className="mono-data text-right font-medium text-ink">treasury wallet only</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 border-b border-rule py-4">
          <dt className="ledger-label shrink-0 text-ink-3">Expires</dt>
          <dd className="mono-data text-right text-ink">04 Oct 2026 · 00:00 UTC</dd>
        </div>
        <div className="pt-4">
          <dt className="ledger-label text-ink-3">Strategy</dt>
          <dd className="mt-2">
            <CopyValue value={DEMO.strategyHash} display="0x4a91f2c7…42f8e0b5d" className="font-medium text-ink" />
          </dd>
        </div>
      </dl>
    </aside>
  );
}
