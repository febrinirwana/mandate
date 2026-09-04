"use client";

import { useInView } from "motion/react";
import { useRef } from "react";
import { Landscape } from "@/components/art/landscape";
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
      <div className="display text-[clamp(2rem,2.9vw,2.75rem)] leading-none tracking-[-0.04em] tabular-nums">{text}</div>
      <div className="mt-2.5 flex items-center gap-2 text-[0.8125rem] font-medium leading-tight text-ink">
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
      <Landscape className="absolute inset-0" />
      {/* full-height column ruling rides above the art, railgun-style */}
      <div className="pointer-events-none absolute inset-0 z-[1] hidden md:block" aria-hidden="true">
        <div className="mx-auto grid h-full max-w-[1440px] grid-cols-4 px-6 lg:px-10">
          <span className="border-l border-rule" />
          <span className="border-l border-rule" />
          <span className="border-l border-rule" />
          <span className="border-l border-rule" />
        </div>
      </div>

      <div className="relative z-[2] mx-auto flex min-h-[calc(100svh-4rem)] max-w-[1440px] flex-col border-x border-rule px-6 lg:px-10">
        <div className="grid flex-1 gap-10 lg:grid-cols-[1.08fr_0.92fr]">
          {/* headline block sits low-left, like the reference */}
          <div className="flex flex-col justify-end pb-14 pt-24 lg:pb-20">
            <h1 className="display text-[clamp(3.25rem,8vw,7.25rem)]">
              Authority without
              <br />
              custody<span style={{ color: "var(--accent)" }}>.</span>
            </h1>
            <p className="mt-7 flex items-center gap-2.5 text-[0.9375rem] text-ink">
              <span className="h-[7px] w-[7px] rotate-45 shrink-0" style={{ background: "var(--accent)" }} aria-hidden="true" />
              One named agent. One immutable Aqua strategy. Output returns to the treasury.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <ButtonLink href={`/mandates/${DEMO_HASH}`} arrow>
                Inspect the demo mandate
              </ButtonLink>
              <ButtonLink href="#how" variant="carbon">
                How a mandate works
              </ButtonLink>
            </div>
          </div>

          {/* stats float over the art in the right columns */}
          <div className="hidden flex-col justify-between py-14 lg:flex">
            <div className="grid grid-cols-2 gap-y-20">
              <StatCell stat={STATS[0]} active={inView} />
              <StatCell stat={STATS[1]} active={inView} />
            </div>
            <div className="grid grid-cols-2 gap-y-20">
              <StatCell stat={STATS[2]} active={inView} />
              <StatCell stat={STATS[3]} active={inView} />
            </div>
          </div>
        </div>

        {/* mobile stats */}
        <div className="grid grid-cols-2 gap-y-8 pb-12 lg:hidden" aria-label="Protocol counters, sample data">
          {STATS.map((s) => (
            <StatCell key={s.label} stat={s} active={inView} />
          ))}
        </div>
      </div>
    </section>
  );
}
