import { ArrowRight as PhArrowRight } from "@phosphor-icons/react/dist/ssr";
import { AuthorityHeader } from "@/components/mandate/authority-header";
import { ConstraintLedger } from "@/components/mandate/constraint-ledger";
import { FlowTrace } from "@/components/mandate/flow-trace";
import { Reveal } from "@/components/ui/reveal";
import { Stamp } from "@/components/ui/kit";

const DEMO_HASH = "0x4a91f2c7d6b3e580a9c1d47fb0e2f53618d7c4a9e5b2f08371c6d9a42f8e0b5d";

/**
 * The interface is the proof — a live inspection surface embedded on the
 * landing page, running the real components with clearly labeled sample
 * state.
 */
export function LiveLedger() {
  return (
    <section className="border-b border-rule" aria-label="Live inspection demo">
      <div className="mx-auto max-w-[1440px] border-x border-rule px-6 py-20 md:py-28 lg:px-10">
        <Reveal>
          <div className="mb-8 flex flex-wrap items-baseline justify-between gap-4">
            <h2 className="display max-w-[24ch] text-[clamp(2rem,4vw,3.5rem)]">
              Inspectable before execution. Undeniable after.
            </h2>
            <Stamp kind="ACTIVE" label="SAMPLE STATE" />
          </div>
        </Reveal>
        <Reveal delay={0.08}>
          <div className="border border-rule bg-raised px-6 py-8 md:px-10">
            <AuthorityHeader compact sentence="May convert USDC → WETH through 1inch Aggregation Router v6, capped per call and in total, output pushed back to the treasury." />
            <div className="mt-8">
              <ConstraintLedger />
            </div>
            <div className="mt-10">
              <FlowTrace />
            </div>
            <div className="mt-8 flex justify-end border-t border-rule pt-4">
              <a
                href={`/mandates/${DEMO_HASH}`}
                className="link-quiet inline-flex items-center gap-1.5 text-[0.9375rem] text-ink-2 hover:text-ink"
              >
                Open the full inspection
                <PhArrowRight size={14} weight="bold" aria-hidden="true" />
              </a>
            </div>
          </div>
        </Reveal>
        <p className="mono-data mt-3 text-ink-3">
          Sample values for design review. A live inspection reads registry, strategy, and balances
          onchain — unknown fails closed.
        </p>
      </div>
    </section>
  );
}
