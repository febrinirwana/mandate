"use client";

import { animate } from "motion";
import { useEffect, useState } from "react";

const STEPS = ["Agent call", "ENS check", "Mandate check", "Aqua pull", "Fixed swap", "Aqua push"] as const;

/**
 * Flow trace — six checkpoints on one path. Before confirmation it is an
 * estimate; after, it is reconstructed from events. The label says which.
 */
export function FlowTrace({ stopped = false, estimate = true }: { stopped?: boolean; estimate?: boolean }) {
  const [lit, setLit] = useState(stopped ? 0 : STEPS.length);

  useEffect(() => {
    if (stopped) {
      setLit(0);
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setLit(STEPS.length);
      return;
    }
    const controls = animate(0, STEPS.length, {
      duration: 7,
      repeat: Infinity,
      repeatDelay: 0.6,
      ease: "linear",
      onUpdate: (v) => setLit(Math.floor(v)),
    });
    return () => controls.stop();
  }, [stopped]);

  return (
    <div>
      <div className="flex items-baseline justify-between border-b border-rule pb-3">
        <h3 className="text-[1.0625rem] font-medium tracking-[-0.01em]">Flow trace</h3>
        <span className="ledger-label text-ink-3">{stopped ? "stopped by revocation" : estimate ? "estimated" : "from events"}</span>
      </div>
      <ol className="relative mt-6 flex flex-col gap-0 md:flex-row md:items-start md:gap-0" aria-label="Execution path">
        {STEPS.map((s, i) => (
          <li
            key={s}
            className="relative flex flex-1 items-center gap-3 pb-6 md:block md:pb-0 md:pr-4 md:pt-5"
            aria-current={lit > i ? "step" : undefined}
          >
            {/* connector line */}
            {i < STEPS.length - 1 && (
              <span
                className="absolute left-[7px] top-6 h-[calc(100%-1.5rem)] w-px bg-rule md:left-[20px] md:top-[27px] md:h-px md:w-[calc(100%-1.9rem)]"
                aria-hidden="true"
                style={{ background: lit > i ? "var(--accent)" : "var(--rule)", transition: "background 400ms var(--ease-out-quart)" }}
              />
            )}
            {/* detent node */}
            <span
              className="relative z-10 grid h-[15px] w-[15px] shrink-0 place-items-center rounded-full border bg-paper transition-colors duration-300"
              style={{
                borderColor: lit > i ? "var(--accent)" : "var(--rule)",
                transitionDelay: `${i * 60}ms`,
              }}
              aria-hidden="true"
            >
              <span
                className="h-[7px] w-[7px] rounded-full transition-all duration-300"
                style={{
                  background: lit > i ? "var(--accent)" : "transparent",
                  transform: lit > i ? "scale(1)" : "scale(0.4)",
                }}
              />
            </span>
            <div className="md:pt-2">
              <div className={`text-[0.875rem] transition-colors duration-300 ${lit > i ? "text-ink" : "text-ink-3"}`}>{s}</div>
            </div>
          </li>
        ))}
      </ol>
      {stopped && (
        <p className="mono-data mt-2 text-ink-2">
          <span style={{ color: "var(--revoked)" }}>REVOKED</span>: further execution reverts onchain.
        </p>
      )}
    </div>
  );
}
