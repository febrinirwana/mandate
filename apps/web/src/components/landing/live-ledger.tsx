import { ArrowRight } from "lucide-react";
import { AuthorityHeader } from "@/components/mandate/authority-header";
import { ConstraintLedger } from "@/components/mandate/constraint-ledger";
import { FlowTrace } from "@/components/mandate/flow-trace";
import { Certificate } from "@/components/art/certificate";
import { Reveal } from "@/components/ui/reveal";
import { Stamp } from "@/components/ui/kit";

const DEMO_HASH = "0x4a91f2c7d6b3e580a9c1d47fb0e2f53618d7c4a9e5b2f08371c6d9a42f8e0b5d";

/**
 * The interface is the proof: the certificate artifact beside a live
 * inspection surface running the real components with clearly labeled
 * sample state.
 */
export function LiveLedger() {
  return (
    <section className="border-b border-rule" aria-label="Live inspection demo">
      <div className="mx-auto max-w-[1440px] border-x border-rule px-6 py-20 md:py-24 lg:px-10">
        <div className="grid items-end gap-10 lg:grid-cols-[1.12fr_0.88fr]">
          <Reveal>
            <h2 className="display max-w-[22ch] text-[clamp(2rem,4vw,3.5rem)]">
              Inspectable before execution. Undeniable after.
            </h2>
            <p className="lede mt-5 max-w-[56ch]">
              The interface is the proof: a live inspection surface running the real components with
              clearly labeled sample state.
            </p>
            <a
              href={`/mandates/${DEMO_HASH}`}
              className="link-quiet mt-7 inline-flex items-center gap-1.5 text-[0.9375rem] font-medium text-ink"
            >
              Open the full inspection
              <ArrowRight size={15} strokeWidth={2.25} aria-hidden="true" />
            </a>
          </Reveal>
          <Reveal delay={0.08} className="hidden justify-self-end lg:block">
            <div className="relative h-[424px] w-[344px]">
              <div className="absolute left-0 top-0 w-[440px] origin-top-left scale-[0.78]">
                <Certificate />
              </div>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.05}>
          <div className="mt-4 border border-rule bg-raised px-6 py-8 md:px-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <AuthorityHeader
                compact
                sentence="May convert USDC → WETH through 1inch Aggregation Router v6, capped per call and in total, output pushed back to the treasury."
              />
            </div>
            <div className="mt-8">
              <ConstraintLedger />
            </div>
            <div className="mt-10">
              <FlowTrace />
            </div>
          </div>
        </Reveal>
        <p className="mono-data mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-ink-3">
          <Stamp kind="ACTIVE" label="SAMPLE STATE" />
          Sample values for design review. A live inspection reads registry, strategy, and balances
          onchain; unknown fails closed.
        </p>
      </div>
    </section>
  );
}
