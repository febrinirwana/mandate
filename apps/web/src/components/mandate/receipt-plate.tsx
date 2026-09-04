import { ExternalLink } from "lucide-react";
import { CopyValue } from "@/components/ui/copy-value";
import { Stamp } from "@/components/ui/kit";
import { CHAIN, DEMO, fmtUnits, minOutput, rateOf, TOKENS } from "@/lib/demo";

const ex = DEMO.lastExecution;
const rate = rateOf(ex.out, TOKENS.out.decimals, ex.in, TOKENS.in.decimals);
const floorPerUnit = DEMO.policy.minRateNumerator / DEMO.policy.minRateDenominator;
const minRequired = minOutput(ex.in, TOKENS.in.decimals, TOKENS.out.decimals, DEMO.policy.minRateNumerator, DEMO.policy.minRateDenominator);

/**
 * Receipt plate — the canonical evidence record for one confirmed execution.
 * Submitted is not confirmed; only this plate may carry CONFIRMED.
 */
export function ReceiptPlate() {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-3">
        <h3 className="text-[1.0625rem] font-medium tracking-[-0.01em]">Receipt</h3>
        <div className="flex items-center gap-2">
          <Stamp kind="CONFIRMED" />
          <Stamp kind="ACTIVE" label="COMPLIANT" />
        </div>
      </div>

      <dl className="mt-4 grid gap-x-10 gap-y-0 md:grid-cols-2">
        <Row label="Transaction">
          <CopyValue value={ex.txHash} display="0x9d7c…d827" className="text-ink" />
          <a
            href={`${CHAIN.explorer}/tx/${ex.txHash}`}
            target="_blank"
            rel="noreferrer"
            className="ml-1 text-ink-3 transition-colors hover:text-accent"
            aria-label="Open transaction in explorer"
          >
            <ExternalLink size={12} strokeWidth={2} aria-hidden="true" />
          </a>
        </Row>
        <Row label="Confirmed">
          <span>
            block {ex.block.toLocaleString("en-US")} · {ex.timestamp.replace("T", " ").replace("Z", " UTC")}
          </span>
        </Row>
        <Row label="Input">
          <span>−{fmtUnits(ex.in, TOKENS.in.decimals, 2)} {TOKENS.in.symbol} from treasury</span>
        </Row>
        <Row label="Output">
          <span>+{fmtUnits(ex.out, TOKENS.out.decimals, 6)} {TOKENS.out.symbol} to treasury</span>
        </Row>
        <Row label="Realized rate">
          <span>
            1 {TOKENS.in.symbol} = {rate.toFixed(6)} {TOKENS.out.symbol}
          </span>
        </Row>
        <Row label="Floor required">
          <span>
            ≥ {minRequired.toFixed(6)} {TOKENS.out.symbol} · {floorPerUnit.toFixed(6)} per unit
          </span>
        </Row>
        <Row label="Budget after">
          <span>
            1,750.00 / 5,000.00 {TOKENS.in.symbol} used
          </span>
        </Row>
        <Row label="Agent balance">
          <span>
            {DEMO.agent.tokenBalance} tokens (gas only: {DEMO.agent.gasBalanceEth.toFixed(4)} ETH)
          </span>
        </Row>
      </dl>

      <div className="mt-5 border-t border-rule pt-4">
        <div className="ledger-label text-ink-3">Events decoded</div>
        <ul className="mono-data mt-2 space-y-1.5 text-ink-2">
          <li>
            <span className="text-ink">MandateExecuted</span>(strategyHash, maker, agent, amountIn, amountOut)
          </li>
          <li>
            <span className="text-ink">Transfer</span>(treasury → AquaApp, 500.000000 {TOKENS.in.symbol})
          </li>
          <li>
            <span className="text-ink">Swap</span>(App → Router, exact-in) · <span className="text-ink">Transfer</span>(Router →
            App, 0.178934 {TOKENS.out.symbol})
          </li>
          <li>
            <span className="text-ink">AquaPush</span>(App → treasury, 0.178934 {TOKENS.out.symbol}), allowance
            cleared
          </li>
        </ul>
      </div>
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
