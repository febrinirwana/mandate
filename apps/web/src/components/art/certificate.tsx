"use client";

import { motion, useInView, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { MoveRight } from "lucide-react";
import { useRef, type PointerEvent } from "react";

/**
 * The Mandate certificate: the product itself rendered as a crisp printed
 * artifact. No sampled dots, no blur: ruled paper, tabular mono fields, a
 * signature that draws itself, and a cobalt rosette seal that stamps in.
 */

const FIELDS = [
  { label: "Agent", value: "vitalik.mandate.eth" },
  { label: "Venue", value: "1INCH AQUA · ROUTER V6" },
  { label: "Cap", value: "50,000 USDC / EXEC · 250,000 TOTAL" },
  { label: "Rate floor", value: "0.00355 WETH PER USDC" },
  { label: "Window", value: "UNTIL 04 OCT 2026 · 00:00 UTC" },
] as const;

/** Crisp 14-scallop notarial rosette with an 8-point star. */
function Seal({ className }: { className?: string }) {
  const scallops = Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * Math.PI * 2;
    return { cx: 50 + Math.cos(a) * 37, cy: 50 + Math.sin(a) * 37 };
  });
  const star = Array.from({ length: 16 }, (_, i) => {
    const r = i % 2 === 0 ? 27 : 11;
    const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
    return `${(50 + Math.cos(a) * r).toFixed(2)},${(50 + Math.sin(a) * r).toFixed(2)}`;
  }).join(" ");
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <g fill="var(--accent)">
        {scallops.map((s, i) => (
          <circle key={i} cx={s.cx} cy={s.cy} r="9.5" />
        ))}
        <circle cx="50" cy="50" r="38" />
      </g>
      <circle cx="50" cy="50" r="31.5" fill="none" stroke="var(--paper-raised)" strokeWidth="1.6" />
      <polygon points={star} fill="var(--paper-raised)" />
    </svg>
  );
}

const SIGNATURE_PATH =
  "M6 38 C 22 12, 40 10, 54 28 C 63 39, 50 50, 43 41 C 36 32, 52 18, 76 22 C 98 26, 108 16, 128 24 M 120 38 L 140 36";

export function Certificate({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const reduced = useReducedMotion();
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rotateX = useSpring(useTransform(py, [-1, 1], [3.5, -3.5]), { stiffness: 130, damping: 18 });
  const rotateY = useSpring(useTransform(px, [-1, 1], [-4.5, 4.5]), { stiffness: 130, damping: 18 });

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (reduced) return;
    const r = e.currentTarget.getBoundingClientRect();
    px.set(((e.clientX - r.left) / r.width) * 2 - 1);
    py.set(((e.clientY - r.top) / r.height) * 2 - 1);
  };
  const onLeave = () => {
    px.set(0);
    py.set(0);
  };

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ perspective: 1400 }}
      initial={reduced ? false : { opacity: 0, y: 32, rotate: -2.5 }}
      animate={inView && !reduced ? { opacity: 1, y: [32, 0, -7, 0], rotate: [-2.5, -1.2, -1.2, -1.2] } : inView ? { opacity: 1, y: 0, rotate: -1.2 } : {}}
      transition={inView ? { duration: 1.6, times: [0, 0.45, 0.78, 1], ease: [0.16, 1, 0.3, 1] } : {}}
    >
      {/* crisp dot-grid patches behind the paper */}
      <div className="dot-grid pointer-events-none absolute -top-10 -right-6 -z-10 hidden h-44 w-44 opacity-50 md:block" aria-hidden="true" />
      <div className="dot-grid pointer-events-none absolute -bottom-8 -left-10 -z-10 hidden h-36 w-56 opacity-40 md:block" aria-hidden="true" />

      <motion.div
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        style={{ rotateX: reduced ? undefined : rotateX, rotateY: reduced ? undefined : rotateY, transformStyle: "preserve-3d" }}
        className="relative mx-auto w-full max-w-[440px] border border-[rgb(26_25_22/0.16)] bg-raised"
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{ boxShadow: "0 1px 0 rgb(26 25 22 / 0.06), 0 36px 70px -36px rgb(26 25 22 / 0.28)" }}
          aria-hidden="true"
        />

        <div className="px-7 pt-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="ledger-label text-ink">Mandate</div>
              <div className="ledger-label mt-1 text-ink-3">Signed operating order</div>
            </div>
            <div className="text-right">
              <span
                className="ledger-label inline-flex items-center gap-1.5 rounded-[2px] px-1.5 py-0.5"
                style={{ background: "var(--accent-soft)", color: "var(--accent-deep)", fontSize: "0.625rem" }}
              >
                <span className="h-[5px] w-[5px] rounded-full" style={{ background: "var(--accent)" }} />
                Active
              </span>
              <div className="mono-data mt-2 text-ink-3">NO. MD-2026-0007</div>
            </div>
          </div>

          <div className="mt-7 flex items-center gap-3 border-b border-rule pb-6">
            <span className="text-[2.125rem] leading-none font-medium tracking-[-0.03em] tabular-nums">USDC</span>
            <MoveRight size={22} strokeWidth={1.75} style={{ color: "var(--accent)" }} aria-label="to" />
            <span className="text-[2.125rem] leading-none font-medium tracking-[-0.03em]">WETH</span>
          </div>

          <dl>
            {FIELDS.map((f, i) => (
              <motion.div
                key={f.label}
                className="flex items-baseline justify-between gap-4 border-b border-rule py-[9px]"
                initial={reduced ? false : { opacity: 0, x: -8 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1], delay: 0.28 + i * 0.09 }}
              >
                <dt className="ledger-label shrink-0 text-ink-3">{f.label}</dt>
                <dd className="mono-data text-right font-medium text-ink">{f.value}</dd>
              </motion.div>
            ))}
          </dl>
        </div>

        <div className="mt-5 flex items-end justify-between border-t border-rule-strong/70 px-7 pt-4 pb-6">
          <div>
            <svg viewBox="0 0 146 56" className="h-11 w-36" aria-hidden="true">
              <motion.path
                d={SIGNATURE_PATH}
                fill="none"
                stroke="var(--ink)"
                strokeWidth="2"
                strokeLinecap="round"
                initial={reduced ? false : { pathLength: 0, opacity: 0 }}
                animate={inView ? { pathLength: 1, opacity: 1 } : {}}
                transition={{ duration: 1.15, ease: [0.25, 1, 0.5, 1], delay: 0.55 }}
              />
            </svg>
            <div className="ledger-label mt-1 text-ink-3">Owner signature · vitalik.mandate.eth</div>
          </div>
          <motion.div
            initial={reduced ? false : { scale: 0, rotate: -18, opacity: 0 }}
            animate={inView ? { scale: 1, rotate: -8, opacity: 1 } : {}}
            transition={inView ? { type: "spring", stiffness: 320, damping: 15, delay: 0.95 } : {}}
            className="relative mr-1"
            style={{ filter: "drop-shadow(0 10px 14px rgb(0 0 254 / 0.18))" }}
          >
            <Seal className="h-[88px] w-[88px]" />
          </motion.div>
        </div>

        <div className="flex items-center justify-between gap-4 bg-ink px-7 py-3">
          <span className="ledger-label" style={{ color: "var(--paper-raised)" }}>
            Treasury custody retained
          </span>
          <span className="flex h-4 items-end gap-[3px]" aria-hidden="true">
            {[2, 4, 2, 5, 3, 2, 4, 2, 5, 2, 3, 4, 2, 2, 5, 3, 2, 4].map((w, i) => (
              <span key={i} className="inline-block" style={{ width: w, height: "100%", background: "var(--paper-raised)" }} />
            ))}
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}
