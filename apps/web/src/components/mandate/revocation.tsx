"use client";

import { Prohibit as PhProhibit } from "@phosphor-icons/react/dist/ssr";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/kit";
import { DEMO } from "@/lib/demo";

export type Path = "mandate" | "aqua" | "ens";

const PATHS: { key: Path; title: string; consequence: string; recovery: string; action: string }[] = [
  {
    key: "mandate",
    title: "Revoke Mandate",
    consequence: "Immediate app-level stop for this strategy hash. Irreversible for this mandate.",
    recovery: "A new mandate requires a fresh strategy and activation.",
    action: "revoke(strategy)",
  },
  {
    key: "aqua",
    title: "Dock Aqua strategy",
    consequence: "Clears every listed virtual balance for the strategy at Aqua.",
    recovery: "Funds already in the treasury wallet; only the allowance lane closes.",
    action: "dock(app, strategy, tokens)",
  },
  {
    key: "ens",
    title: "Revoke ENS identity",
    consequence: "Invalidates the agent identity itself — execution fails on identity checks.",
    recovery: "May affect other uses of the name; expiry also ends it naturally.",
    action: "unregister(subname)",
  },
];

/**
 * Revocation console — three independent stop paths, each confirmed alone.
 * In this demo the signature is simulated; the state flip is real UI state.
 */
export function Revocation({ revoked, onRevoke }: { revoked: boolean; onRevoke: (path: Path) => void }) {
  const [pending, setPending] = useState<Path | null>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const lastTrigger = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (pending) confirmRef.current?.focus();
  }, [pending]);

  const close = () => {
    setPending(null);
    lastTrigger.current?.focus();
  };

  const target = PATHS.find((p) => p.key === pending);

  return (
    <div>
      <div className="flex items-baseline justify-between border-b border-rule pb-3">
        <h3 className="text-[1.0625rem] font-medium tracking-[-0.01em]">Revocation console</h3>
        <span className="ledger-label" style={{ color: "var(--revoked)" }}>
          owner only · demo signature
        </span>
      </div>

      <ul>
        {PATHS.map((p) => (
          <li key={p.key} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-rule py-4 last:border-b-0">
            <div className="min-w-0 flex-1 basis-64">
              <div className="flex items-center gap-2 text-[0.9375rem]">
                {revoked ? (
                  <span className="font-medium" style={{ color: "var(--revoked)" }}>
                    {p.title} — exercised
                  </span>
                ) : (
                  p.title
                )}
              </div>
              <p className="mono-data mt-1 text-ink-2">
                {p.consequence} <span className="text-ink-3">{p.recovery}</span>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <code className="mono-data text-ink-3">{p.action}</code>
              <Button
                variant={revoked ? "ghost" : "carbon"}
                className="h-9 px-3.5 text-[0.8125rem]"
                disabled={revoked}
                onClick={(e) => {
                  lastTrigger.current = e.currentTarget;
                  setPending(p.key);
                }}
              >
                <PhProhibit size={13} weight="bold" aria-hidden="true" />
                {revoked ? "Stopped" : "Sign"}
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {target && (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-ink/40 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="revoke-title"
          onKeyDown={(e) => e.key === "Escape" && close()}
          onClick={(e) => e.target === e.currentTarget && close()}
        >
          <div
            className="w-full max-w-[28rem] rounded-[12px] border border-rule bg-raised p-6 shadow-[0_24px_64px_-24px_rgb(0_0_0/0.35)]"
            style={{ transformOrigin: "center" }}
          >
            <h4 id="revoke-title" className="text-[1.0625rem] font-medium">
              Confirm — {target.title}
            </h4>
            <p className="mono-data mt-3 text-ink-2">{target.consequence}</p>
            <p className="mono-data mt-2 text-ink-3">
              agent {DEMO.agent.ens} · strategy 0x4a91…0b5d
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="ghost" className="h-10" onClick={close}>
                Cancel
              </Button>
              <Button
                ref={confirmRef}
                variant="carbon"
                className="h-10"
                style={{ background: "var(--revoked)" }}
                onClick={() => {
                  onRevoke(target.key);
                  close();
                }}
              >
                Revoke in demo
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
