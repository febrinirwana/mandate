"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Ban } from "lucide-react";
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
    consequence: "Invalidates the agent identity itself: execution fails on identity checks.",
    recovery: "May affect other uses of the name; expiry also ends it naturally.",
    action: "unregister(subname)",
  },
];

/**
 * Revocation console — three independent stop paths, each confirmed alone.
 * In this demo the signature is simulated; the state flip is real UI state.
 * Focus trap, Escape, and aria wiring come from the Radix dialog primitive.
 */
export function Revocation({ revoked, onRevoke }: { revoked: boolean; onRevoke: (path: Path) => void }) {
  const [pending, setPending] = useState<Path | null>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (pending) confirmRef.current?.focus();
  }, [pending]);

  const close = () => setPending(null);
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
                    {p.title} · exercised
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
                onClick={() => setPending(p.key)}
              >
                <Ban size={13} strokeWidth={2.5} aria-hidden="true" />
                {revoked ? "Stopped" : "Sign"}
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <Dialog.Root open={!!target} onOpenChange={(open) => !open && close()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[100] bg-ink/40 backdrop-blur-[2px]" />
          <Dialog.Content
            className="fixed left-1/2 top-1/2 z-[101] w-[calc(100%-2rem)] max-w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-[12px] border border-rule bg-raised p-6 shadow-[0_24px_64px_-24px_rgb(0_0_0/0.35)]"
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              confirmRef.current?.focus();
            }}
          >
            <Dialog.Title className="text-[1.0625rem] font-medium">Confirm: {target?.title}</Dialog.Title>
            <Dialog.Description className="mono-data mt-3 text-ink-2">{target?.consequence}</Dialog.Description>
            <p className="mono-data mt-2 text-ink-3">
              agent {DEMO.agent.ens} · strategy 0x4a91…0b5d
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Dialog.Close asChild>
                <Button variant="ghost" className="h-10">
                  Cancel
                </Button>
              </Dialog.Close>
              <Button
                ref={confirmRef}
                variant="carbon"
                className="h-10"
                style={{ background: "var(--revoked)" }}
                onClick={() => {
                  if (pending) onRevoke(pending);
                  close();
                }}
              >
                Revoke in demo
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
