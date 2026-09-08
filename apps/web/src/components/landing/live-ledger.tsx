import { ArrowRight } from "lucide-react";

import { Certificate } from "@/components/art/certificate";
import { Reveal } from "@/components/ui/reveal";
import { Stamp } from "@/components/ui/kit";

const DEMO_HASH = "0x4a91f2c7d6b3e580a9c1d47fb0e2f53618d7c4a9e5b2f08371c6d9a42f8e0b5d";

export function LiveLedger() {
  return (
    <section className="border-b border-rule" aria-label="Inspection preview">
      <div className="mx-auto max-w-[1440px] border-x border-rule px-6 py-20 md:py-24 lg:px-10">
        <div className="grid items-end gap-10 lg:grid-cols-[1.12fr_0.88fr]">
          <Reveal>
            <h2 className="display max-w-[22ch] text-[clamp(2rem,4vw,3.5rem)]">Inspectable before execution. Undeniable after.</h2>
            <p className="lede mt-5 max-w-[56ch]">Public inspection requires no wallet. Enter any strategy hash to load block-stamped authority, cap, expiry, settlement, and stop state.</p>
            <a href={`/mandates/${DEMO_HASH}`} className="link-quiet mt-7 inline-flex items-center gap-1.5 text-[0.9375rem] font-medium text-ink">Open labeled sample inspection<ArrowRight size={15} strokeWidth={2.25} aria-hidden="true" /></a>
          </Reveal>
          <Reveal delay={0.08} className="hidden justify-self-end lg:block"><div className="relative h-[424px] w-[344px]"><div className="absolute left-0 top-0 w-[440px] origin-top-left scale-[0.78]"><Certificate /></div></div></Reveal>
        </div>
        <Reveal delay={0.05}>
          <div className="mt-8 border border-rule bg-raised p-6 md:p-10">
            <Stamp kind="UNKNOWN" label="SAMPLE: synthetic design preview" />
            <p className="mt-4 max-w-[58ch] text-[1.125rem] leading-relaxed">Live routes never reuse this sample. They fetch and validate typed API responses at a block, and UNKNOWN replaces stale or unavailable chain truth.</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
