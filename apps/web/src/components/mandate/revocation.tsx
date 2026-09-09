"use client";

import type { MandateSnapshotV1 } from "@mandate/domain";
import * as Dialog from "@radix-ui/react-dialog";
import { Ban } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/kit";
import type { MandateRuntime } from "@/lib/runtime.server";
import { dockStrategy, revokeMandate, type WalletState } from "@/lib/wallet";

type Path = "mandate" | "aqua" | "ens";

const paths: Record<Path, { title: string; consequence: string; action: string }> = {
  mandate: {
    title: "Revoke Mandate",
    consequence:
      "Irreversibly stops this strategy hash at MandateAquaApp. A previously passing execution reverts.",
    action: "revoke(strategyHash)",
  },
  aqua: {
    title: "Dock Aqua strategy",
    consequence:
      "Clears this strategy's virtual balances. Mandate execution no longer has an active Aqua lane.",
    action: "dock(app, strategyHash, [tokenIn, tokenOut])",
  },
  ens: {
    title: "Change or unregister ENS identity",
    consequence:
      "Changing current owner, resolver, or address record invalidates the live identity check at execution time.",
    action: "owner-managed ENSv2 action",
  },
};

export function Revocation({
  snapshot,
  runtime,
  onSubmitted,
}: {
  snapshot: MandateSnapshotV1;
  runtime: MandateRuntime;
  onSubmitted: () => void;
}) {
  const [pending, setPending] = useState<Path>();
  const [walletState, setWalletState] = useState<WalletState>({ kind: "IDLE" });
  const target = pending ? paths[pending] : undefined;
  const stopped = snapshot.state.revoked;
  const walletText =
    walletState.kind === "SUBMITTED"
      ? `SUBMITTED: ${walletState.txHash}. Waiting for block-stamped refresh.`
      : walletState.kind === "REJECTED"
        ? "Wallet rejected. Nothing changed."
        : walletState.kind === "WRONG_CHAIN"
          ? `Wrong chain: ${walletState.actual}.`
          : walletState.kind === "WRONG_ACCOUNT"
            ? `Wrong owner account: ${walletState.actual}.`
            : walletState.kind === "REVERTED"
              ? `REVERTED: ${walletState.message}`
              : walletState.kind === "UNAVAILABLE"
                ? "Wallet unavailable."
                : "";

  const submit = async () => {
    if (!pending || pending === "ens") return;
    const state =
      pending === "mandate"
        ? await revokeMandate(snapshot, runtime.mandateApp)
        : await dockStrategy(snapshot, runtime.mandateApp);
    setWalletState(state);
    setPending(undefined);
    if (state.kind === "SUBMITTED") onSubmitted();
  };

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 border-b border-rule pb-3">
        <h3 className="text-[1.0625rem] font-medium tracking-[-0.01em]">Revocation console</h3>
        <span className="ledger-label" style={{ color: "var(--revoked)" }}>
          owner only
        </span>
      </div>
      <ul>
        {(Object.keys(paths) as Path[]).map((key) => {
          const path = paths[key];
          const direct = key !== "ens";
          return (
            <li
              key={key}
              className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-rule py-4 last:border-b-0"
            >
              <div className="min-w-0 flex-1 basis-64">
                <p className="text-[0.9375rem] font-medium">{path.title}</p>
                <p className="mono-data mt-1 text-ink-2">{path.consequence}</p>
              </div>
              <div className="flex items-center gap-3">
                <code className="mono-data max-w-52 break-all text-ink-3">{path.action}</code>
                <Button
                  variant={direct ? "carbon" : "ghost"}
                  disabled={stopped}
                  onClick={() => direct && setPending(key)}
                >
                  <Ban size={13} strokeWidth={2.5} aria-hidden="true" />
                  {direct ? "Sign" : "Use ENS owner console"}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      {walletText && (
        <p role="status" className="mono-data mt-4 text-ink-2">
          {walletText}
        </p>
      )}
      <Dialog.Root
        open={Boolean(target && pending !== "ens")}
        onOpenChange={(open) => !open && setPending(undefined)}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[100] bg-ink/40 backdrop-blur-[2px]" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[101] w-[calc(100%-2rem)] max-w-[28rem] -translate-x-1/2 -translate-y-1/2 border border-rule bg-raised p-6 shadow-[0_24px_64px_-24px_rgb(0_0_0/0.35)]">
            <Dialog.Title className="text-[1.0625rem] font-medium">
              Confirm: {target?.title}
            </Dialog.Title>
            <Dialog.Description className="mono-data mt-3 text-ink-2">
              {target?.consequence}
            </Dialog.Description>
            <p className="mono-data mt-3 break-all text-ink-3">strategy {snapshot.strategyHash}</p>
            <div className="mt-6 flex justify-end gap-3">
              <Dialog.Close asChild>
                <Button variant="ghost">Cancel</Button>
              </Dialog.Close>
              <Button
                variant="carbon"
                style={{ background: "var(--revoked)" }}
                onClick={() => void submit()}
              >
                Sign owner stop
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
