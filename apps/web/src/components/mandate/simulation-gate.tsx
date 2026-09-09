"use client";

import {
  SimulationRequestV1Schema,
  type MandateSnapshotV1,
  type SimulationV1,
} from "@mandate/domain";
import { Activity, Send } from "lucide-react";
import { useEffect, useState } from "react";
import type { Hex } from "viem";

import { Button } from "@/components/ui/kit";
import { simulate } from "@/lib/api";
import { isSimulationCurrent } from "@/lib/mandate";
import type { MandateRuntime } from "@/lib/runtime.server";
import { submitExecution, type WalletState } from "@/lib/wallet";

export function SimulationGate({
  snapshot,
  runtime,
  onSubmitted,
}: {
  snapshot: MandateSnapshotV1;
  runtime: MandateRuntime;
  onSubmitted: (txHash: Hex) => void;
}) {
  const [amountIn, setAmountIn] = useState(snapshot.strategy.maxInputPerCall);
  const [agentMinOut, setAgentMinOut] = useState("0");
  const [deadline, setDeadline] = useState("2000000000");
  const [routeData, setRouteData] = useState<string>(snapshot.strategy.swapSelector);
  const [simulation, setSimulation] = useState<SimulationV1>();
  const [requestState, setRequestState] = useState<"IDLE" | "LOADING" | "OUTAGE" | "INVALID">(
    "IDLE",
  );
  const [walletState, setWalletState] = useState<WalletState>({ kind: "IDLE" });

  useEffect(() => {
    setSimulation(undefined);
    setWalletState({ kind: "IDLE" });
  }, [amountIn, agentMinOut, deadline, routeData, snapshot.block.hash]);

  const request = SimulationRequestV1Schema.safeParse({
    chainId: snapshot.chainId,
    mandateApp: runtime.mandateApp,
    strategy: snapshot.strategy,
    amountIn,
    agentMinOut,
    executionDeadline: deadline,
    routeData,
  });
  const current =
    simulation && request.success ? isSimulationCurrent(simulation.binding, request.data) : false;
  const walletText =
    walletState.kind === "SUBMITTED"
      ? `SUBMITTED: ${walletState.txHash}. Awaiting canonical receipt.`
      : walletState.kind === "REJECTED"
        ? "Wallet rejected: validated intent and completed setup steps are preserved."
        : walletState.kind === "WRONG_CHAIN"
          ? `Wrong chain: ${walletState.actual}.`
          : walletState.kind === "WRONG_ACCOUNT"
            ? `Wrong account: ${walletState.actual}.`
            : walletState.kind === "UNAVAILABLE"
              ? "Wallet unavailable."
              : walletState.kind === "REVERTED"
                ? `REVERTED: ${walletState.message}`
                : "";

  const run = async () => {
    if (!request.success) {
      setSimulation(undefined);
      setRequestState("INVALID");
      return;
    }
    setRequestState("LOADING");
    const result = await simulate(request.data);
    if (result.kind === "READY") {
      setSimulation(result.data);
      setRequestState("IDLE");
      return;
    }
    setSimulation(undefined);
    setRequestState("OUTAGE");
  };

  const execute = async () => {
    if (!simulation || simulation.result !== "PASS" || !current || !request.success) return;
    const state = await submitExecution(request.data);
    setWalletState(state);
    if (state.kind === "SUBMITTED") onSubmitted(state.txHash);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-3">
        <h3 className="text-[1.0625rem] font-medium tracking-[-0.01em]">Simulation gate</h3>
        <Button variant="ghost" onClick={() => void run()} disabled={requestState === "LOADING"}>
          <Activity size={14} strokeWidth={2.5} aria-hidden="true" />
          {requestState === "LOADING" ? "Simulating…" : "Run exact simulation"}
        </Button>
      </div>
      <p className="mt-3 text-[0.875rem] leading-relaxed text-ink-2">
        PASS is simulation-only and advisory. It is bound to the exact agent, strategy, calldata,
        state block, and deadline below. Any change invalidates it.
      </p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="grid gap-1.5">
          <span className="ledger-label text-ink-3">amountIn base units</span>
          <input
            aria-label="amountIn base units"
            className="mono-data min-h-11 border border-rule bg-raised px-3"
            value={amountIn}
            onChange={(event) => setAmountIn(event.target.value)}
          />
        </label>
        <label className="grid gap-1.5">
          <span className="ledger-label text-ink-3">agentMinOut base units</span>
          <input
            aria-label="agentMinOut base units"
            className="mono-data min-h-11 border border-rule bg-raised px-3"
            value={agentMinOut}
            onChange={(event) => setAgentMinOut(event.target.value)}
          />
        </label>
        <label className="grid gap-1.5">
          <span className="ledger-label text-ink-3">execution deadline unix seconds</span>
          <input
            aria-label="execution deadline unix seconds"
            className="mono-data min-h-11 border border-rule bg-raised px-3"
            value={deadline}
            onChange={(event) => setDeadline(event.target.value)}
          />
        </label>
        <label className="grid gap-1.5">
          <span className="ledger-label text-ink-3">route calldata</span>
          <input
            aria-label="route calldata"
            className="mono-data min-h-11 border border-rule bg-raised px-3"
            value={routeData}
            onChange={(event) => setRouteData(event.target.value)}
          />
        </label>
      </div>
      {requestState === "INVALID" && (
        <p role="status" className="mono-data mt-4 text-unknown">
          INVALID: exact StrategyV1 or execution fields are malformed. No simulation was sent.
        </p>
      )}
      {requestState === "OUTAGE" && (
        <p role="status" className="mono-data mt-4 text-unknown">
          UNKNOWN: simulation service or RPC unavailable. Do not submit.
        </p>
      )}
      {simulation && (
        <div className="mt-5 border-y border-rule py-4" aria-live="polite">
          <p
            className="mono-data font-medium"
            style={{
              color:
                simulation.result === "PASS"
                  ? "var(--accent)"
                  : simulation.result === "FAIL"
                    ? "var(--revoked)"
                    : "var(--unknown)",
            }}
          >
            {simulation.result}{" "}
            {simulation.result === "PASS" ? "· SIMULATION ONLY" : "· DO NOT SUBMIT"}
          </p>
          <p className="mono-data mt-2 break-all text-ink-2">
            block {simulation.binding.blockNumber} · {simulation.binding.blockHash} · expires{" "}
            {simulation.binding.expiresAt}
          </p>
          <ul className="mt-3 space-y-2">
            {simulation.checks.map((check, index) => (
              <li key={`${check.code}-${index}`} className="mono-data flex justify-between gap-3">
                <span>{check.code}</span>
                <span>{check.result}</span>
              </li>
            ))}
          </ul>
          <p className="mono-data mt-3 text-ink-2">
            expected maker movement: {simulation.expectedMovement.makerTokenInDelta} input · +
            {simulation.expectedMovement.makerTokenOutMinimumDelta} output minimum · agent{" "}
            {simulation.expectedMovement.agentTokenDelta}
          </p>
        </div>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button
          onClick={() => void execute()}
          disabled={!simulation || simulation.result !== "PASS" || !current}
        >
          <Send size={14} strokeWidth={2.5} aria-hidden="true" />
          Execute from dedicated agent wallet
        </Button>
        {!current && simulation && (
          <span className="mono-data text-unknown">
            STALE: intent or state binding changed. Simulate again.
          </span>
        )}
        {walletText && (
          <p role="status" className="mono-data text-ink-2">
            {walletText}
          </p>
        )}
      </div>
    </div>
  );
}
