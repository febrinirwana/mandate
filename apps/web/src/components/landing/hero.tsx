"use client";

import { Repeat2 } from "lucide-react";
import { useInView } from "motion/react";
import { useRef } from "react";
import { Certificate } from "@/components/art/certificate";
import { ButtonLink } from "@/components/ui/kit";
import { useCountUp } from "@/lib/use-count-up";

const DEMO_HASH = "0x4a91f2c7d6b3e580a9c1d47fb0e2f53618d7c4a9e5b2f08371c6d9a42f8e0b5d";

const STATS = [
  { value: 4, format: (v: number) => Math.round(v).toString(), label: "active mandates", tone: "var(--accent)" },
  { value: 512_400, format: (v: number) => `${(v / 1000).toFixed(1)}K`, label: "USDC settled · sample", tone: "var(--confirmed)" },
  { value: 0, format: (v: number) => v.toString(), label: "tokens held by agents", tone: "var(--accent)" },
  { value: 3, format: (v: number) => Math.round(v).toString(), label: "independent stop paths", tone: "var(--unknown)" },
] as const;

function StatCell({ stat, active }: { stat: (typeof STATS)[number]; active: boolean }) {
  const text = useCountUp(stat.value, active, stat.format);
  return (
    <div className="pl-5">
      <div className="display text-[2.375rem] leading-none tracking-[-0.04em] tabular-nums">{text}</div>
      <div className="mt-2 flex items-center gap-2 text-[0.8125rem] leading-tight text-ink-2">
        <span className="h-[6px] w-[6px] shrink-0 rounded-full" style={{ background: stat.tone }} aria-hidden="true" />
        {stat.label}
      </div>
    </div>
  );
}

export function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });

  return (
    <section ref={ref} className="relative overflow-hidden border-b border-rule" aria-label="Introduction">
      {/* full-height column ruling */}
      <div className="pointer-events-none absolute inset-0 hidden md:block" aria-hidden="true">
        <div className="mx-auto grid h-full max-w-[1440px] grid-cols-4 px-6 lg:px-10">
          <span className="border-l border-rule" />
          <span className="border-l border-rule" />
          <span className="border-l border-rule" />
          <span className="border-l border-rule" />
        </div>
      </div>

      <div className="relative mx-auto flex min-h-[92svh] max-w-[1440px] flex-col border-x border-rule px-6 lg:px-10">
        <div className="grid flex-1 items-center gap-14 pt-16 pb-14 lg:grid-cols-[1.02fr_0.98fr] lg:gap-8 lg:pt-20">
          <div>
            <h1 className="display max-w-[12ch] text-[clamp(3rem,7vw,5.75rem)]">
              Authority without custody<span style={{ color: "var(--accent)" }}>.</span>
            </h1>
            <p className="lede mt-6 max-w-[52ch]">
              One named agent. One immutable Aqua strategy. A revocable, expiring authority, with treasury
              custody never leaving the owner wallet.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <ButtonLink href={`/mandates/${DEMO_HASH}`} arrow>
                Inspect the demo mandate
              </ButtonLink>
              <ButtonLink href="#how" variant="carbon">
                How a mandate works
              </ButtonLink>
            </div>
            <p className="mono-data mt-8 flex items-center gap-2 text-ink-2">
              <Repeat2 size={15} strokeWidth={2} className="text-accent" aria-hidden="true" />
              Pull. Swap. Push. Output returns to the treasury, never to the agent.
            </p>
          </div>

          <div className="relative lg:justify-self-end">
            <Certificate />
          </div>
        </div>

        <div className="grid gap-y-8 border-t border-rule py-9 md:grid-cols-4" aria-label="Protocol counters, sample data">
          {STATS.map((s) => (
            <StatCell key={s.label} stat={s} active={inView} />
          ))}
        </div>
      </div>
    </section>
  );
}
