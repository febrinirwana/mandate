"use client";

import { ArrowUpRight, BadgeCheck, FileSignature, Fingerprint, type LucideIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Reveal } from "@/components/ui/reveal";

type Chapter = {
  num: string;
  title: string;
  icon: LucideIcon;
  caption: string;
  detail: React.ReactNode;
};

const CHAPTERS: Chapter[] = [
  {
    num: "01",
    title: "Identity",
    icon: Fingerprint,
    caption: "A live ENSv2 name bound to the dedicated signer, verified against the registry onchain at execution time.",
    detail: (
      <div className="flex items-center gap-2">
        <span className="mono-data font-medium text-ink">vitalik.mandate.eth</span>
        <span
          className="ledger-label inline-flex items-center gap-1 rounded-[2px] px-1.5 py-0.5"
          style={{ background: "var(--confirmed-soft)", color: "var(--confirmed)", fontSize: "0.5625rem" }}
        >
          <BadgeCheck size={11} strokeWidth={2.4} />
          Verified
        </span>
      </div>
    ),
  },
  {
    num: "02",
    title: "Mandate",
    icon: FileSignature,
    caption: "One immutable strategy: pair, route, rate floor, caps, and window, shipped to Aqua and activated by hash.",
    detail: (
      <div className="flex items-center gap-2">
        <span className="mono-data font-medium text-ink">USDC → WETH · 50K / EXEC</span>
        <motion.span
          initial={{ scale: 0, rotate: -14, opacity: 0 }}
          whileInView={{ scale: 1, rotate: -6, opacity: 1 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ type: "spring", stiffness: 340, damping: 14, delay: 0.35 }}
          className="ledger-label inline-block rounded-[2px] px-1.5 py-0.5"
          style={{ background: "var(--accent-soft)", color: "var(--accent-deep)", fontSize: "0.5625rem" }}
        >
          Sealed
        </motion.span>
      </div>
    ),
  },
  {
    num: "03",
    title: "Settlement",
    icon: ArrowUpRight,
    caption: "Aqua pulls from the treasury wallet, swaps through the fixed venue, and pushes output straight back. The agent never touches custody.",
    detail: (
      <div className="relative flex items-center justify-between">
        <span className="mono-data text-[0.6875rem] font-medium text-ink-2">PULL</span>
        <span className="absolute inset-x-8 top-1/2 h-px -translate-y-1/2 bg-rule" aria-hidden="true" />
        <span className="mono-data relative text-[0.6875rem] font-medium text-ink-2">SWAP</span>
        <span className="mono-data relative text-[0.6875rem] font-medium text-ink-2">PUSH</span>
        <motion.span
          className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full"
          style={{ background: "var(--accent)" }}
          animate={{ left: ["4%", "50%", "92%"], opacity: [0, 1, 1, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", times: [0, 0.45, 1] }}
          aria-hidden="true"
        />
      </div>
    ),
  },
];

function Plate({ chapter, index }: { chapter: Chapter; index: number }) {
  const reduced = useReducedMotion();
  const Icon = chapter.icon;
  return (
    <Reveal delay={0.08 * index} className="h-full">
      <article
        className={`group relative flex h-full flex-col border bg-raised p-6 transition-all duration-300 ${
          reduced ? "border-rule hover:border-ink" : "border-rule hover:-translate-y-1 hover:border-ink/50 hover:shadow-[0_18px_40px_-24px_rgb(26_25_22/0.25)]"
        }`}
      >
        <div className="flex items-start justify-between">
          <span className="grid h-16 w-16 place-items-center rounded-[6px] border border-rule bg-paper transition-colors duration-300 group-hover:border-ink/30">
            <Icon size={30} strokeWidth={1.75} className="text-ink transition-colors duration-300 group-hover:text-accent" />
          </span>
          <span className="mono-data text-ink-3">{chapter.num}</span>
        </div>

        <h3 className="mt-6 border-b border-rule pb-3 text-[1.0625rem] font-medium tracking-[-0.01em]">{chapter.title}</h3>
        <p className="mt-3 flex-1 text-[0.875rem] leading-relaxed text-ink-2">{chapter.caption}</p>
        <div className="mt-5 border-t border-rule pt-4">{chapter.detail}</div>
      </article>
    </Reveal>
  );
}

export function Chapters() {
  return (
    <section id="how" className="border-b border-rule" aria-label="How a mandate works">
      <div className="mx-auto max-w-[1440px] border-x border-rule px-6 py-20 md:py-28 lg:px-10">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <h2 className="display max-w-[16ch] text-[clamp(2.25rem,4.6vw,4rem)]">How a mandate works</h2>
            <a
              href="https://github.com/1inch/aqua"
              target="_blank"
              rel="noreferrer"
              className="link-quiet inline-flex items-center gap-1.5 pb-1.5 text-[0.9375rem] text-ink-2 hover:text-ink"
            >
              Read the protocol docs
              <ArrowUpRight size={15} strokeWidth={2} aria-hidden="true" />
            </a>
          </div>
        </Reveal>
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {CHAPTERS.map((c, i) => (
            <Plate key={c.num} chapter={c} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
