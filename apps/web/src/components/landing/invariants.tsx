"use client";

import { Check } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";

const INVARIANTS = [
  {
    name: "ATOMIC_ROLLBACK",
    text: "A failed route, short output, or blocked push reverts the entire transaction. No partial settlement.",
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
    text: "Registry, expiry, owner, and resolver are re-read at execution. Cached answers cannot authorize.",
  },
  {
    name: "FAIL_CLOSED",
    text: "Unknown RPC, ENS, or deployment state yields UNKNOWN, never a green light.",
  },
] as const;

export function Invariants() {
  return (
    <section id="invariants" className="border-b border-rule" aria-label="Security invariants">
      <div className="mx-auto max-w-[1440px] border-x border-rule px-6 py-20 md:py-28 lg:px-10">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <span
                className="inline-block rounded-[4px] px-3 pb-1 pt-0.5 text-[clamp(1.75rem,3vw,2.5rem)] font-medium tracking-[-0.02em]"
                style={{ background: "var(--ink)", color: "var(--paper)" }}
              >
                Invariants
              </span>
              <p className="lede mt-6 max-w-[56ch]">
                Every mandate enforces the same printed rules. Not configuration: the physics of the contract.
              </p>
            </div>
            <span className="ledger-label pb-2 text-ink-3">Printed rules · not configuration</span>
          </div>
        </Reveal>
        <ul className="mt-12">
          {INVARIANTS.map((inv, i) => (
            <Reveal key={inv.name} delay={0.05 * i}>
              <li className="flex items-center gap-5 border-t border-rule py-5 last:border-b">
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-[4px]"
                  style={{ background: "var(--confirmed-soft)", color: "var(--confirmed)" }}
                  aria-hidden="true"
                >
                  <Check size={18} strokeWidth={2.6} />
                </span>
                <code className="mono-data w-44 shrink-0 font-medium text-ink max-sm:w-full">{inv.name}</code>
                <span className="max-w-[64ch] text-[0.9375rem] leading-relaxed text-ink-2">{inv.text}</span>
              </li>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
