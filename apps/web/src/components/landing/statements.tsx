"use client";

import { At as PhAt, Pulse as PhPulse, SealCheck as PhSealCheck } from "@phosphor-icons/react/dist/ssr";
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react";
import { useRef } from "react";

const STATEMENTS = [
  {
    num: "01",
    body: (
      <>
        Identity is <Chip icon={<PhAt weight="bold" />} /> live state, verified onchain at execution time —
        never a cached approval.
      </>
    ),
  },
  {
    num: "02",
    body: (
      <>
        The contract authorizes. <Chip icon={<PhPulse weight="bold" />} /> Simulation only informs.
      </>
    ),
  },
  {
    num: "03",
    body: (
      <>
        Custody <Chip icon={<PhSealCheck weight="bold" />} /> never leaves the treasury wallet.
      </>
    ),
  },
] as const;

function Chip({ icon }: { icon: React.ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="mx-1 inline-grid h-[0.72em] w-[0.72em] translate-y-[0.08em] place-items-center rounded-[0.16em] align-baseline text-[0.44em]"
      style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
    >
      {icon}
    </span>
  );
}
function bounds(index: number, total: number) {
  const p0 = index / total;
  const p1 = (index + 1) / total;
  const first = index === 0;
  const last = index === total - 1;
  return {
    inStart: first ? 0 : Math.max(0.001, p0 - 0.07),
    inEnd: first ? 0.04 : p0 + 0.03,
    outStart: last ? 0.965 : p1 - 0.06,
    outEnd: last ? 1 : p1 - 0.01,
  };
}

function Statement({
  index,
  total,
  progress,
  children,
}: {
  index: number;
  total: number;
  progress: MotionValue<number>;
  children: React.ReactNode;
}) {
  const b = bounds(index, total);
  const first = index === 0;
  const last = index === total - 1;
  const opacity = useTransform(progress, [b.inStart, b.inEnd, b.outStart, b.outEnd], [0, 1, 1, 0]);
  const y = useTransform(progress, [b.inStart, b.inEnd, b.outStart, b.outEnd], [first ? 0 : 26, 0, 0, last ? 0 : -26]);
  const blur = useTransform(progress, [b.inStart, b.inEnd, b.outStart, b.outEnd], [first ? 0 : 5, 0, 0, last ? 0 : 5]);
  const filter = useTransform(blur, (v) => `blur(${v}px)`);

  return (
    <motion.div
      className="absolute inset-x-0 top-1/2 mx-auto -translate-y-1/2 text-center"
      style={{ opacity, y, filter }}
    >
      {children}
    </motion.div>
  );
}

function NumeralColumn({ progress, side }: { progress: MotionValue<number>; side: "left" | "right" }) {
  const numerals = STATEMENTS.map((s, i) => {
    const b = bounds(i, STATEMENTS.length);
    return { num: s.num, bounds: b };
  });
  return (
    <div
      className={`pointer-events-none absolute inset-y-0 ${side === "left" ? "left-6 lg:left-10" : "right-6 lg:right-10"} hidden w-10 md:block`}
      aria-hidden="true"
    >
      <span className="absolute left-1/2 top-0 h-[38%] w-px bg-rule" />
      <span className="absolute bottom-0 left-1/2 h-[38%] w-px bg-rule" />
      {numerals.map((n, i) => (
        <Numeral key={n.num} label={n.num} bounds={n.bounds} progress={progress} top={14 + i * 33} />
      ))}
    </div>
  );
}

function Numeral({
  label,
  bounds,
  progress,
  top,
}: {
  label: string;
  bounds: { inStart: number; inEnd: number; outStart: number; outEnd: number };
  progress: MotionValue<number>;
  top: number;
}) {
  const opacity = useTransform(progress, [bounds.inStart, bounds.inEnd, bounds.outStart, bounds.outEnd], [0, 1, 1, 0]);
  return (
    <motion.span
      className="mono-data absolute left-1/2 -translate-x-1/2"
      style={{ opacity, top: `${top}%` }}
    >
      {label}
    </motion.span>
  );
}

export function Statements() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  if (reduced) {
    return (
      <section className="border-b border-rule" aria-label="Principles">
        <div className="mx-auto max-w-[1440px] space-y-16 border-x border-rule px-6 py-24 text-center lg:px-10">
          {STATEMENTS.map((s) => (
            <p key={s.num} className="statement mx-auto max-w-[24ch] text-[clamp(1.75rem,4vw,3.5rem)]">
              {s.body}
            </p>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section ref={ref} className="relative border-b border-rule" style={{ height: "320vh" }} aria-label="Principles">
      <div className="sticky top-0 flex h-[100svh] items-center overflow-hidden">
        <NumeralColumn progress={scrollYProgress} side="left" />
        <NumeralColumn progress={scrollYProgress} side="right" />
        <div className="relative mx-auto w-full max-w-[1440px] px-6 lg:px-10">
          <div className="relative h-[26rem] md:h-[30rem]">
            {STATEMENTS.map((s, i) => (
              <Statement key={s.num} index={i} total={STATEMENTS.length} progress={scrollYProgress}>
                <p className="statement mx-auto max-w-[24ch] text-[clamp(1.875rem,4.2vw,3.75rem)]">{s.body}</p>
              </Statement>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
