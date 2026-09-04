"use client";

import { useMemo } from "react";
import { Halftone } from "@/components/dot/halftone";
import { sceneSignature } from "@/components/dot/scenes";
import { useTheme } from "@/components/theme";
import { Reveal } from "@/components/ui/reveal";

const INVARIANTS = [
  {
    name: "ATOMIC_ROLLBACK",
    text: "A failed route, short output, or blocked push reverts the entire transaction — no partial settlement.",
  },
  {
    name: "NO_RESIDUE",
    text: "Input is fully spent, the app holds no token balance after the call, and allowances return to zero.",
  },
  {
    name: "OUTPUT_TO_MAKER",
    text: "Settlement output is pushed to the treasury wallet through Aqua; the agent has no recipient choice.",
  },
  {
    name: "IDENTITY_IS_LIVE",
    text: "Registry, expiry, owner, and resolver are re-read at execution — cached answers cannot authorize.",
  },
  {
    name: "FAIL_CLOSED",
    text: "Unknown RPC, ENS, or deployment state yields UNKNOWN, never a green light.",
  },
] as const;

export function Invariants() {
  const { theme } = useTheme();
  const palette = useMemo(
    () => (theme === "dark" ? { base: "#2a2a34", accent: "#b9e34e", baseAlpha: 0.5 } : { base: "#1a1916", accent: "#7ea51d", baseAlpha: 0.5 }),
    [theme],
  );

  return (
    <section id="invariants" className="border-b border-rule" aria-label="Security invariants">
      <div className="mx-auto grid max-w-[1440px] gap-12 border-x border-rule px-6 py-20 md:py-28 lg:grid-cols-[1.15fr_0.85fr] lg:px-10">
        <div>
          <Reveal>
            <span
              className="inline-block rounded-[4px] px-3 pb-1 pt-0.5 text-[clamp(1.75rem,3vw,2.5rem)] font-medium tracking-[-0.02em]"
              style={{ background: "var(--ink)", color: "var(--paper)" }}
            >
              Invariants
            </span>
            <p className="lede mt-6 max-w-[56ch]">
              Every mandate enforces the same printed rules. Not configuration — physics of the
              contract.
            </p>
          </Reveal>
          <ul className="mt-10">
            {INVARIANTS.map((inv, i) => (
              <Reveal key={inv.name} delay={0.05 * i}>
                <li className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-1 border-t border-rule py-4 last:border-b">
                  <code className="mono-data shrink-0 font-medium text-ink">{inv.name}</code>
                  <span className="max-w-[52ch] text-[0.875rem] leading-relaxed text-ink-2">{inv.text}</span>
                  <span className="h-[6px] w-[6px] shrink-0 self-center rounded-full" style={{ background: "var(--confirmed)" }} aria-hidden="true" />
                </li>
              </Reveal>
            ))}
          </ul>
        </div>
        <Reveal delay={0.1} className="min-h-[320px]">
          <Halftone draw={sceneSignature} palette={palette} cell={4} className="h-full min-h-[320px] w-full" parallax={6} />
        </Reveal>
      </div>
    </section>
  );
}
