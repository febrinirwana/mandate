"use client";

import { Check, Droplets, ExternalLink, LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { formatUnits } from "viem";

import { Button } from "@/components/ui/kit";
import {
  demoFaucetRawAmount,
  didDemoFundingConfirm,
  parseDemoFundingState,
  type DemoFundingState,
} from "@/lib/demo-faucet";
import {
  buildDemoFaucetCall,
  submitSmartWalletCalls,
  type SmartWalletClient,
} from "@/lib/privy-wallet";
import type { PolicyProfileV1 } from "@/lib/policy";
import type { WalletState } from "@/lib/wallet";

function fundingMessage(state: WalletState): string | undefined {
  if (state.kind === "REJECTED")
    return "Funding request rejected. Your authority form is unchanged.";
  if (state.kind === "REVERTED")
    return "Funding transaction could not be submitted. Check the Sepolia paymaster configuration.";
  if (state.kind === "UNAVAILABLE") return "Privy smart wallet is unavailable.";
  return undefined;
}

export function DemoFaucet({
  profile,
  amount,
  required,
  maker,
  client,
  onBalance,
}: {
  profile: PolicyProfileV1;
  amount: string;
  required: string;
  maker: `0x${string}`;
  client: SmartWalletClient | undefined;
  onBalance: (balance: bigint | undefined) => void;
}) {
  const [funding, setFunding] = useState<DemoFundingState>({ kind: "UNAVAILABLE" });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [walletState, setWalletState] = useState<WalletState>({ kind: "IDLE" });
  const [balanceBefore, setBalanceBefore] = useState<bigint>();

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/demo-funding?account=${encodeURIComponent(maker)}`, {
        cache: "no-store",
      });
      const next = parseDemoFundingState(await response.json());
      setFunding(next);
      onBalance(next.kind === "READY" ? BigInt(next.balance) : undefined);
    } catch {
      setFunding({ kind: "UNAVAILABLE" });
      onBalance(undefined);
    } finally {
      setLoading(false);
    }
  }, [maker, onBalance]);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (walletState.kind !== "SUBMITTED") return;
    const timer = window.setInterval(() => void refresh(), 2_500);
    return () => window.clearInterval(timer);
  }, [refresh, walletState.kind]);

  useEffect(() => {
    if (walletState.kind === "SUBMITTED" && didDemoFundingConfirm(balanceBefore, funding)) {
      setWalletState({ kind: "CONFIRMED", txHash: walletState.txHash });
    }
  }, [balanceBefore, funding, walletState]);

  const fund = async () => {
    const rawAmount = demoFaucetRawAmount(amount, profile.tokenIn.decimals);
    if (!rawAmount || funding.kind !== "READY") return;
    setSubmitting(true);
    setWalletState({ kind: "IDLE" });
    setBalanceBefore(BigInt(funding.balance));
    const next = await submitSmartWalletCalls(client, [
      buildDemoFaucetCall(profile.tokenIn.address, maker, rawAmount),
    ]);
    setWalletState(next);
    setSubmitting(false);
    if (next.kind === "SUBMITTED") void refresh();
  };

  const formattedBalance =
    funding.kind === "READY"
      ? formatUnits(BigInt(funding.balance), profile.tokenIn.decimals)
      : undefined;
  const message = fundingMessage(walletState);

  return (
    <section
      className="mt-4 border border-accent/25 bg-[var(--accent-ghost)] p-4"
      aria-labelledby="demo-funding-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p id="demo-funding-title" className="ledger-label text-accent">
            Sepolia demo funds
          </p>
          <p className="mt-2 max-w-[46ch] text-sm leading-6 text-ink-2">
            Mint test-only {profile.tokenIn.symbol} to this exact smart wallet. No real USDC is
            used.
          </p>
        </div>
        <dl className="grid gap-3 text-right sm:grid-cols-2">
          <div>
            <dt className="ledger-label text-ink-3">Available</dt>
            <dd className="mono-data mt-1" aria-live="polite">
              {loading
                ? "Reading Sepolia…"
                : formattedBalance === undefined
                  ? "Unavailable"
                  : `${formattedBalance} ${profile.tokenIn.symbol}`}
            </dd>
          </div>
          <div>
            <dt className="ledger-label text-ink-3">Required cap</dt>
            <dd className="mono-data mt-1">
              {required} {profile.tokenIn.symbol}
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-accent/15 pt-4">
        <Button
          onClick={() => void fund()}
          disabled={submitting || !client || funding.kind !== "READY"}
        >
          {submitting ? (
            <LoaderCircle className="motion-safe:animate-spin" size={15} aria-hidden="true" />
          ) : (
            <Droplets size={15} aria-hidden="true" />
          )}
          {submitting ? "Requesting funds…" : `Add ${amount} demo ${profile.tokenIn.symbol}`}
        </Button>
        {funding.kind === "READY" && funding.funded && (
          <span className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-confirmed">
            <Check size={15} aria-hidden="true" /> Demo balance ready
          </span>
        )}
      </div>

      <div className="mt-3 min-h-5" aria-live="polite">
        {walletState.kind === "SUBMITTED" && (
          <a
            className="mono-data link-quiet inline-flex items-center gap-1 text-accent"
            href={`https://sepolia.etherscan.io/tx/${walletState.txHash}`}
            target="_blank"
            rel="noreferrer"
          >
            Submitted on Sepolia <ExternalLink size={12} aria-hidden="true" />
          </a>
        )}
        {walletState.kind === "CONFIRMED" && (
          <a
            className="mono-data link-quiet inline-flex items-center gap-1 text-confirmed"
            href={`https://sepolia.etherscan.io/tx/${walletState.txHash}`}
            target="_blank"
            rel="noreferrer"
          >
            Funds confirmed <ExternalLink size={12} aria-hidden="true" />
          </a>
        )}
        {message && (
          <p role="status" className="mono-data text-revoked">
            {message}
          </p>
        )}
      </div>
    </section>
  );
}
