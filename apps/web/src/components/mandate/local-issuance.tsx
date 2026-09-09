"use client";

import Link from "next/link";
import { Check, LockKeyhole } from "lucide-react";
import { useMemo, useState } from "react";
import { keccak256, stringToHex } from "viem";

import { Button } from "@/components/ui/kit";
import { CopyValue } from "@/components/ui/copy-value";
import { strategyHash } from "@/lib/mandate";
import { compilePolicy, type PolicyProfileV1 } from "@/lib/policy";
import type { PolicyReadiness } from "@/lib/policy-readiness";
import {
  activateStrategy,
  approveAqua,
  confirmSubmitted,
  shipStrategy,
  type WalletState,
} from "@/lib/wallet";
import type { MandateRuntime } from "@/lib/runtime.server";

const newSalt = () => keccak256(stringToHex(crypto.randomUUID()));

type LocalState = WalletState & { completed: number };

export function LocalIssuance({
  profile,
  runtime,
  readiness,
}: {
  profile: PolicyProfileV1;
  runtime: MandateRuntime;
  readiness: PolicyReadiness;
}) {
  const [maker, setMaker] = useState<`0x${string}`>();
  const [maxInput, setMaxInput] = useState("");
  const [minRate, setMinRate] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [salt, setSalt] = useState(newSalt);
  const [state, setState] = useState<LocalState>({ kind: "IDLE", completed: 0 });
  const strategy = useMemo(() => {
    if (!maker) return undefined;
    try {
      return compilePolicy(
        {
          version: 1,
          agent: profile.agent.name,
          tokenIn: profile.tokenIn.symbol,
          tokenOut: profile.tokenOut.symbol,
          maxInput,
          minRate,
          expiresAt,
        },
        profile,
        {
          maker,
          validAfter: String(Math.floor(Date.now() / 1_000) - 3_600),
          salt,
          maxMandateDuration: readiness.kind === "READY" ? readiness.maxMandateDuration : undefined,
        },
      );
    } catch {
      return undefined;
    }
  }, [expiresAt, maker, maxInput, minRate, profile, readiness, salt]);
  const connect = async () => {
    const accounts = await window.ethereum?.request({ method: "eth_requestAccounts" });
    const account =
      Array.isArray(accounts) &&
      typeof accounts[0] === "string" &&
      /^0x[0-9a-fA-F]{40}$/.test(accounts[0])
        ? (accounts[0].toLowerCase() as `0x${string}`)
        : undefined;
    setMaker(account);
  };
  const runNext = async () => {
    if (!maker || !strategy || readiness.kind !== "READY") return;
    if (state.kind === "SUBMITTED") {
      const confirmed = await confirmSubmitted(state);
      setState({
        ...confirmed,
        completed: confirmed.kind === "CONFIRMED" ? state.completed + 1 : state.completed,
      });
      return;
    }
    const submission =
      state.completed === 0
        ? await approveAqua(
            runtime.chainId,
            maker,
            readiness.aqua,
            strategy.tokenIn,
            strategy.maxInputTotal,
          )
        : state.completed === 1
          ? await approveAqua(runtime.chainId, maker, readiness.aqua, strategy.tokenOut, "0")
          : state.completed === 2
            ? await shipStrategy(
                runtime.chainId,
                maker,
                readiness.aqua,
                runtime.mandateApp,
                strategy,
              )
            : await activateStrategy(runtime.chainId, maker, runtime.mandateApp, strategy);
    const confirmed = await confirmSubmitted(submission);
    setState({
      ...confirmed,
      completed: confirmed.kind === "CONFIRMED" ? state.completed + 1 : state.completed,
    });
  };
  const step = [
    `Approve ${profile.tokenIn.symbol} to Aqua`,
    `Set ${profile.tokenOut.symbol} Aqua approval to zero`,
    "Ship the exact cap into Aqua virtual balance",
    "Activate the exact Mandate StrategyV1",
  ];
  const message =
    state.kind === "REJECTED"
      ? "Wallet rejected. Completed steps and exact fields are preserved."
      : state.kind === "SUBMITTED"
        ? `SUBMITTED: ${state.txHash}. Awaiting receipt; not confirmed.`
        : state.kind === "REVERTED"
          ? `REVERTED: ${state.message}`
          : state.kind === "UNAVAILABLE"
            ? "Local browser wallet unavailable."
            : state.kind === "CONFIRMED"
              ? "Confirmed. Continue to the next explicit step."
              : "";

  return (
    <div className="mx-auto max-w-[1440px] border-x border-rule">
      <section className="grid gap-8 border-b border-rule px-6 py-8 lg:grid-cols-[1fr_auto] lg:px-10">
        <div>
          <p className="ledger-label text-ink-3">Local Anvil proof · exact StrategyV1</p>
          <h1 className="display mt-3 text-[clamp(2.5rem,5vw,4.5rem)]">
            Exercise authority without production keys.
          </h1>
        </div>
        <div className="self-start border border-rule bg-raised px-4 py-3 text-right">
          <p className="ledger-label text-ink-3">Local owner</p>
          <p
            aria-label={maker ? `Local owner ${maker}` : "Local owner not connected"}
            className="mono-data mt-1"
          >
            {maker ? `${maker.slice(0, 6)}…${maker.slice(-4)}` : "Not connected"}
          </p>
        </div>
      </section>
      <main className="grid lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.72fr)]">
        <section className="border-b border-rule px-6 py-10 lg:border-b-0 lg:border-r lg:px-10 lg:py-14">
          <p className="ledger-label text-ink-3">Four explicit transactions</p>
          <Button className="mt-5" onClick={() => void connect()}>
            <LockKeyhole size={15} aria-hidden="true" />
            Connect local owner wallet
          </Button>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2">
              <span className="ledger-label text-ink-3">
                Maximum spend · {profile.tokenIn.symbol}
              </span>
              <input
                aria-label="Maximum spend"
                inputMode="decimal"
                value={maxInput}
                onChange={(event) => {
                  setMaxInput(event.target.value);
                  setSalt(newSalt());
                  setState({ kind: "IDLE", completed: 0 });
                }}
                className="min-h-11 border border-rule bg-raised px-3"
              />
            </label>
            <label className="grid gap-2">
              <span className="ledger-label text-ink-3">Minimum output rate</span>
              <input
                aria-label="Minimum output rate"
                inputMode="decimal"
                value={minRate}
                onChange={(event) => {
                  setMinRate(event.target.value);
                  setSalt(newSalt());
                  setState({ kind: "IDLE", completed: 0 });
                }}
                className="min-h-11 border border-rule bg-raised px-3"
              />
            </label>
            <label className="grid gap-2 sm:col-span-2">
              <span className="ledger-label text-ink-3">Expiry</span>
              <input
                aria-label="Expiry"
                type="datetime-local"
                value={expiresAt}
                onChange={(event) => {
                  setExpiresAt(event.target.value);
                  setSalt(newSalt());
                  setState({ kind: "IDLE", completed: 0 });
                }}
                className="min-h-11 border border-rule bg-raised px-3"
              />
            </label>
          </div>
          <ol className="mt-7 grid gap-3" aria-label="Local authorization transaction sequence">
            {step.map((label, index) => (
              <li key={label} className="flex items-center gap-3 border border-rule p-3">
                <span className="mono-data">{index < state.completed ? "✓" : `${index + 1}.`}</span>
                <span>{label}</span>
              </li>
            ))}
          </ol>
          <Button
            className="mt-5"
            onClick={() => void runNext()}
            disabled={!strategy || !maker || readiness.kind !== "READY" || state.completed === 4}
          >
            {state.completed === 4
              ? "Authority active"
              : state.kind === "SUBMITTED"
                ? "Check transaction receipt"
                : step[state.completed]}
          </Button>
          {state.completed === 4 && strategy && (
            <Link
              href={`/mandates/${strategyHash(strategy)}`}
              className="mt-3 inline-flex min-h-11 items-center border border-rule px-4 text-[0.75rem] font-semibold uppercase tracking-[0.08em] transition-colors hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Inspect active authority
            </Link>
          )}
          {message && (
            <p role="status" className="mono-data mt-3 text-ink-2">
              {message}
            </p>
          )}
        </section>
        <aside className="bg-raised px-6 py-10 lg:px-8 lg:py-14">
          <p className="ledger-label text-ink-3">Exact local authority</p>
          {strategy ? (
            <>
              <p className="mt-5 text-[1.35rem]">
                {profile.agent.name} may move at most {maxInput} {profile.tokenIn.symbol}.
              </p>
              <CopyValue value={strategyHash(strategy)} />
              <p className="mono-data mt-5 break-all text-[0.6875rem] leading-5 text-ink-2">
                route {strategy.swapTarget} · {strategy.swapSelector}
                <br />
                cap {strategy.maxInputTotal}
                <br />
                valid until {strategy.validUntil}
              </p>
            </>
          ) : (
            <p role="status" className="mono-data mt-5 text-unknown">
              Connect the owner and provide every exact economic field.
            </p>
          )}
          <p className="mt-8 border-t border-rule pt-5 text-[0.875rem] leading-relaxed text-ink-2">
            <Check className="mr-2 inline" size={14} aria-hidden="true" />
            This local-only path accepts an injected Anvil wallet. Production issuance requires
            Privy on Sepolia.
          </p>
        </aside>
      </main>
    </div>
  );
}
