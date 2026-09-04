"use client";

import { ArrowUpRight as PhArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Halftone, type DrawScene } from "@/components/dot/halftone";
import { sceneIdentity, sceneMandate, sceneSettlement } from "@/components/dot/scenes";
import { useTheme } from "@/components/theme";

const CHAPTERS = [
  {
    num: "01",
    title: "Identity",
    caption: "A live ENSv2 name, bound to the dedicated signer and verified onchain at execution time.",
    scene: sceneIdentity,
  },
  {
    num: "02",
    title: "Mandate",
    caption: "One immutable strategy: pair, route, rate floor, caps, and window — shipped to Aqua, activated by hash.",
    scene: sceneMandate,
  },
  {
    num: "03",
    title: "Settlement",
    caption: "Aqua pulls bounded input from the treasury, swaps one fixed route, and pushes output home.",
    scene: sceneSettlement,
  },
] as const;

function ChapterArt({
  scene,
  index,
  progress,
  isActive,
}: {
  scene: DrawScene;
  index: number;
  progress: MotionValue<number>;
  isActive: boolean;
}) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const activePalette = useMemo(
    () => (dark ? { base: "#2a2a34", accent: "#8a91ff", baseAlpha: 0.45 } : { base: "#1a1916", accent: "#5f7f00", baseAlpha: 0.45 }),
    [dark],
  );
  const idlePalette = useMemo(
    () => (dark ? { base: "#26262c", accent: "#3c3c46", baseAlpha: 0.55 } : { base: "#a8a496", accent: "#8f8b7d", baseAlpha: 0.55 }),
    [],
  );
  const first = index === 0;
  const inStart = first ? 0 : Math.max(0.001, (index - 0.55) / 3);
  const inEnd = first ? 0.02 : Math.max(inStart + 0.001, Math.min(0.96, (index - 0.28) / 3));
  const outStart = index === 2 ? 0.97 : Math.min(0.98, (index + 0.62) / 3);
  const outEnd = index === 2 ? 1 : Math.max(outStart + 0.001, Math.min(1, (index + 0.9) / 3));
  const activeOpacity = useTransform(progress, [inStart, inEnd, outStart, outEnd], [0, 1, 1, 0]);

  return (
    <div className="relative aspect-[5/4] w-full">
      <Halftone draw={scene} palette={idlePalette} cell={5} className="absolute inset-0" entry={false} />
      <motion.div className="absolute inset-0" style={{ opacity: isActive ? 1 : activeOpacity }}>
        <Halftone draw={scene} palette={activePalette} cell={5} className="absolute inset-0" entry={false} />
      </motion.div>
    </div>
  );
}

export function Chapters() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const [active, setActive] = useState(0);

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    if (reduced) return;
    const i = Math.min(CHAPTERS.length - 1, Math.max(0, Math.floor(v * 3)));
    setActive((prev) => (prev === i ? prev : i));
  });

  const jumpTo = (i: number) => {
    const el = ref.current;
    if (el && !reduced) {
      const top = el.offsetTop + (el.offsetHeight - window.innerHeight) * (i / 3 + 0.02);
      window.scrollTo({ top, behavior: "smooth" });
    }
    setActive(i);
  };

  return (
    <section
      id="how"
      ref={ref}
      className={`relative border-b border-rule ${reduced ? "" : "md:h-[340vh]"}`}
      
    >
      <div className={reduced ? "" : "sticky top-0 flex h-[100svh] flex-col overflow-hidden"}>
        <div className="mx-auto w-full max-w-[1440px] border-x border-rule px-6 pt-20 lg:px-10 lg:pt-24">
          <div className="flex items-baseline justify-between gap-6">
            <h2 className="display text-[clamp(2.25rem,4.6vw,4rem)]">How a mandate works</h2>
            <a
              href="https://github.com/1inch/aqua"
              target="_blank"
              rel="noreferrer"
              className="link-quiet hidden items-center gap-1 text-[0.9375rem] text-ink-2 hover:text-ink md:inline-flex"
            >
              Read the protocol docs
              <PhArrowUpRight size={14} weight="bold" aria-hidden="true" />
            </a>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-10 md:mt-16 md:grid-cols-3 md:gap-8">
            {CHAPTERS.map((c, i) => (
              <button
                key={c.num}
                type="button"
                onClick={() => jumpTo(i)}
                className="group text-left"
                aria-label={`Chapter ${c.num} ${c.title}`}
                aria-current={active === i ? "true" : undefined}
              >
                <ChapterArt scene={c.scene} index={i} progress={scrollYProgress} isActive={reduced || active === i} />
                <div className="mt-4 flex items-baseline gap-3 border-t border-rule pt-3">
                  <span className="mono-data text-ink-3">{c.num}</span>
                  <span
                    className={`text-[0.9375rem] transition-colors duration-300 ${
                      active === i ? "text-ink" : "text-ink-3 group-hover:text-ink-2"
                    }`}
                  >
                    {c.title}
                  </span>
                </div>
                <p
                  className={`mt-2 max-w-[36ch] text-[0.875rem] leading-relaxed transition-all duration-500 ${
                    active === i ? "text-ink-2" : "hidden md:block md:opacity-0"
                  }`}
                  style={{ transitionTimingFunction: "var(--ease-out-quart)" }}
                >
                  {c.caption}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
