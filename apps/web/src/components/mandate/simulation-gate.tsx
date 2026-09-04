"use client";

import { Pulse as PhPulse } from "@phosphor-icons/react/dist/ssr";
import { useState } from "react";
import { Button } from "@/components/ui/kit";
import { DEMO } from "@/lib/demo";
import { Stamp } from "@/components/ui/kit";

type CheckState = "idle" | "checking" | "pass";

const COLUMNS: { title: string; checks: string[] }[] = [
  {
    title: "Identity",
    checks: ["ENS name registered", "current owner is agent", "resolver address matches", "identity not expired"],
  },
  {
    title: "Policy",
    checks: ["caller is dedicated agent", "per-call cap holds", "total budget holds", "rate floor satisfied", "inside time window"],
  },
  {
    title: "Settlement",
    checks: ["fixed target + selector", "quote clears floor", "exact-input, no residue", "allowance returns to zero"],
  },
];

const CHECK_MS = 420;

/**
 * Simulation gate — three columns of typed checks. Advisory by definition:
 * the banner and the contract agree that only onchain checks authorize.
 */
export function SimulationGate({ stopped = false }: { stopped?: boolean }) {
  const [state, setState] = useState<CheckState>("idle");
  const [checkedCount, setCheckedCount] = useState(0);
  const total = COLUMNS.reduce((n, c) => n + c.checks.length, 0);

  const run = () => {
    if (state === "checking" || stopped) return;
    setState("checking");
    setCheckedCount(0);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setCheckedCount(i);
      if (i >= total) {
        clearInterval(id);
        setState("pass");
      }
    }, CHECK_MS / 2);
  };

  const flatIndex = (col: number, row: number) => COLUMNS.slice(0, col).reduce((n, c) => n + c.checks.length, 0) + row;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-3">
        <h3 className="text-[1.0625rem] font-medium tracking-[-0.01em]">Simulation gate</h3>
        <Button variant="ghost" className="h-9 px-3.5 text-[0.8125rem]" onClick={run} disabled={state === "checking" || stopped}>
          <PhPulse size={14} weight="bold" aria-hidden="true" />
          {state === "checking" ? "Checking…" : state === "pass" ? "Run again" : "Run simulation"}
        </Button>
      </div>

      <p className="mt-3 text-[0.875rem] leading-relaxed text-ink-2">
        Simulation is advisory. The contract repeats every check at execution — a pass here never
        authorizes by itself.
      </p>
      <p className="mono-data mt-2 text-ink-3">
        bound to block {DEMO.simulation.bindingBlock.toLocaleString("en-US")} · expires 84s after issue ·{" "}
        {state === "pass" ? "PASS at issue time" : "awaiting run"}
      </p>

      <div className="mt-6 grid gap-8 md:grid-cols-3">
        {COLUMNS.map((col, ci) => (
          <div key={col.title}>
            <div className="ledger-label text-ink-3">{col.title}</div>
            <ul className="mt-3 space-y-0">
              {col.checks.map((check, ri) => {
                const idx = flatIndex(ci, ri);
                const done = state === "pass" || (state === "checking" && checkedCount > idx);
                const checking = state === "checking" && checkedCount === idx;
                return (
                  <li
                    key={check}
                    className="flex items-center justify-between gap-3 border-b border-rule py-2.5 last:border-b-0"
                  >
                    <span className={`text-[0.875rem] ${done ? "text-ink" : "text-ink-2"}`}>{check}</span>
                    {done ? (
                      <Stamp kind="PASS" label="PASS" />
                    ) : checking ? (
                      <span className="mono-data animate-pulse text-accent">···</span>
                    ) : (
                      <span className="mono-data text-ink-3">—</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {state === "pass" && !stopped && (
        <p className="mono-data mt-5 text-ink-2">
          <span style={{ color: "var(--accent)" }}>PASS — SIMULATION ONLY.</span> Expected movement: maker −500.00
          USDC → +0.178934… WETH · agent delta 0.
        </p>
      )}
      {stopped && (
        <p className="mono-data mt-5" style={{ color: "var(--revoked)" }}>
          FAIL — MANDATE_REVOKED. Identical calldata, different world state.
        </p>
      )}
    </div>
  );
}
