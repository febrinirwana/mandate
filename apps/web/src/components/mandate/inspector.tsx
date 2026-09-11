"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { CheckCircle2, ChevronRight, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Hex } from "viem";

import { AquaBalances } from "@/components/mandate/aqua-balances";
import { AgentRun } from "@/components/mandate/agent-run";
import { BazanticLane } from "@/components/mandate/bazantic-lane";
import type { BazanticLaneProof } from "@/components/mandate/bazantic-lane";
import { AuthorityHeader } from "@/components/mandate/authority-header";
import { ConstraintLedger } from "@/components/mandate/constraint-ledger";
import { FlowTrace } from "@/components/mandate/flow-trace";
import { OrderSummary } from "@/components/mandate/order-summary";
import { ReceiptPlate } from "@/components/mandate/receipt-plate";
import { Revocation } from "@/components/mandate/revocation";
import { SectionHead } from "@/components/mandate/section-head";
import { SimulationGate } from "@/components/mandate/simulation-gate";
import { StrategyFields } from "@/components/mandate/strategy-fields";
import { Button, Stamp } from "@/components/ui/kit";
import { CopyValue } from "@/components/ui/copy-value";
import {
  readAudit,
  readExecution,
  readMandate,
  type ExecutionV1,
  type MandateSnapshotV1,
  type ReceiptAuditV1,
} from "@/lib/api";
import type { MandateRuntime } from "@/lib/runtime.server";
const OwnerControls = dynamic(
  () => import("@/components/mandate/owner-controls").then((module) => module.OwnerControls),
  { ssr: false },
);

type InspectionState =
  | { kind: "LOADING" }
  | { kind: "PENDING" }
  | { kind: "READY"; snapshot: MandateSnapshotV1 }
  | { kind: "UNKNOWN"; reason: string };

export function MandateInspector({
  hash,
  runtime,
  initialTxHash,
  justIssued = false,
  activationTx,
  bazanticProof,
}: {
  hash: string;
  runtime: MandateRuntime | null;
  initialTxHash?: Hex;
  justIssued?: boolean;
  activationTx?: Hex;
  bazanticProof?: BazanticLaneProof;
}) {
  const [state, setState] = useState<InspectionState>({ kind: "LOADING" });
  const [stale, setStale] = useState(false);
  const [txHash, setTxHash] = useState<Hex | undefined>(initialTxHash);
  const [execution, setExecution] = useState<ExecutionV1>();
  const [audit, setAudit] = useState<ReceiptAuditV1>();
  const [transactionState, setTransactionState] = useState<"SUBMITTED" | "REVERTED" | "REORGED">();
  const [manageAuthority, setManageAuthority] = useState(false);
  const activationPolls = useRef(0);

  const refresh = useCallback(async () => {
    setStale(false);
    if (!runtime || !/^0x[0-9a-fA-F]{64}$/.test(hash)) {
      setState({ kind: "UNKNOWN", reason: "Runtime configuration or strategy hash is invalid." });
      return;
    }
    if (activationPolls.current === 0) setState({ kind: "LOADING" });
    const result = await readMandate(runtime.chainId, hash.toLowerCase());
    if (result.kind === "READY") {
      activationPolls.current = 0;
      setState({ kind: "READY", snapshot: result.data });
      return;
    }
    if (justIssued && activationTx && activationPolls.current < 24) {
      activationPolls.current += 1;
      setState({ kind: "PENDING" });
      return;
    }
    setState({
      kind: "UNKNOWN",
      reason:
        result.kind === "NOT_FOUND"
          ? "No activated strategy was found for this hash."
          : "RPC/API state is unavailable or invalid. No green state is cached.",
    });
  }, [activationTx, hash, justIssued, runtime]);

  const loadReceipt = useCallback(async (chainId: string, submittedHash: Hex) => {
    const result = await readExecution(chainId, submittedHash);
    if (result.kind !== "READY") return;
    setExecution(result.data);
    setTransactionState(result.data.status === "REORGED" ? "REORGED" : undefined);
    const receiptAudit = await readAudit(chainId, submittedHash);
    if (receiptAudit.kind === "READY") setAudit(receiptAudit.data);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (state.kind !== "PENDING") return;
    const timer = window.setTimeout(() => void refresh(), 5_000);
    return () => window.clearTimeout(timer);
  }, [refresh, state]);
  useEffect(() => {
    if (state.kind !== "READY") return;
    const timer = window.setTimeout(() => setStale(true), 30_000);
    return () => window.clearTimeout(timer);
  }, [state]);
  useEffect(() => {
    if (state.kind !== "READY" || !runtime || !txHash) return;
    void loadReceipt(runtime.chainId, txHash);
  }, [loadReceipt, runtime, state.kind, txHash]);

  if (state.kind === "PENDING") {
    return (
      <div
        className="mx-auto max-w-[1440px] border-x border-rule px-6 py-24 lg:px-10"
        role="status"
      >
        <p className="ledger-label text-accent">Four-call activation submitted</p>
        <h1 className="display mt-4 text-[clamp(2rem,4vw,3.25rem)]">
          Waiting for Sepolia inclusion
        </h1>
        <p className="lede mt-4 max-w-[62ch]">
          Privy returned the transaction hash, so you are already on the permanent strategy URL.
          Mandate is polling live chain state; no separate “canonical report” is required to open
          this page.
        </p>
        {activationTx && <CopyValue value={activationTx} className="mt-6" />}
      </div>
    );
  }
  if (state.kind === "LOADING") {
    return (
      <div
        className="mx-auto max-w-[1440px] border-x border-rule px-6 py-24 lg:px-10"
        role="status"
      >
        <p className="mono-data">Loading block-stamped mandate state…</p>
      </div>
    );
  }
  if (state.kind === "UNKNOWN" || !runtime) {
    return (
      <div className="mx-auto max-w-[1440px] border-x border-rule px-6 py-24 lg:px-10">
        <Stamp kind="UNKNOWN" label="UNKNOWN" />
        <h1 className="display mt-5 text-[clamp(2rem,4vw,3.25rem)]">Mandate state unavailable</h1>
        <p className="lede mt-4 max-w-[60ch]">
          {state.kind === "UNKNOWN" ? state.reason : "Runtime is not configured."}
        </p>
        <CopyValue value={hash || "unknown"} className="mt-6" />
        <Button className="mt-8" onClick={() => void refresh()}>
          <RefreshCw size={14} aria-hidden="true" />
          Refresh live state
        </Button>
      </div>
    );
  }

  const snapshot = state.snapshot;
  return (
    <div className="mx-auto max-w-[1440px] border-x border-rule px-6 py-10 lg:px-10 lg:py-14">
      <nav aria-label="Breadcrumb" className="mono-data flex items-center gap-2 text-ink-3">
        <Link href="/" className="link-quiet hover:text-ink">
          mandates
        </Link>
        <ChevronRight size={12} strokeWidth={2.25} aria-hidden="true" />
        <CopyValue value={snapshot.strategyHash} />
      </nav>
      {justIssued && (
        <section className="mt-8 grid gap-6 border border-confirmed/35 bg-confirmed-soft/55 p-6 sm:grid-cols-[auto_1fr_auto] sm:items-center">
          <CheckCircle2 className="text-confirmed" size={30} aria-hidden="true" />
          <div>
            <p className="ledger-label text-confirmed">Authority active on Sepolia</p>
            <h1 className="mt-2 text-[1.45rem] font-medium tracking-[-0.025em]">
              The four-call activation is included and readable onchain.
            </h1>
            <p className="mt-2 text-sm text-ink-2">
              Strategy state comes from the stamped Sepolia block below. A canonical execution
              receipt is created later, only after the constrained agent submits a permitted call.
            </p>
          </div>
          <Link href="/issue" className="link-quiet text-sm font-medium text-confirmed">
            Issue another
          </Link>
        </section>
      )}
      <nav
        aria-label="Inspector sections"
        className="mono-data mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[0.75rem] text-ink-3"
      >
        <a href="#overview" className="link-quiet hover:text-ink">
          Overview
        </a>
        <a href="#agent-run" className="link-quiet hover:text-ink">
          Agent run
        </a>
        <a href="#evidence" className="link-quiet hover:text-ink">
          Evidence
        </a>
        <a href="#safety" className="link-quiet hover:text-ink">
          Safety
        </a>
      </nav>
      <div
        id="overview"
        className="mt-10 grid grid-cols-[minmax(0,1fr)] items-end gap-12 border-b border-rule pb-14 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]"
      >
        <div>
          <AuthorityHeader
            snapshot={snapshot}
            agentName={runtime.policyProfile?.agent.name}
            sentence="The named ENS agent identity is reusable across mandates and independent from this Privy owner wallet. The agent may act only through this immutable strategy."
          />
          {stale && (
            <p role="status" className="mono-data mt-4 text-unknown">
              UNKNOWN: this snapshot is stale. Refresh before relying on state.
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            <Button variant="ghost" onClick={() => void refresh()}>
              <RefreshCw size={14} aria-hidden="true" />
              Refresh block-stamped state
            </Button>
          </div>
        </div>
        <OrderSummary snapshot={snapshot} profile={runtime.policyProfile} />
      </div>
      <section className="mt-14" aria-label="Authority boundaries">
        <SectionHead
          num="01"
          title="Authority at a glance"
          lede="One live read answers what the agent may do, how much remains, and where the owner’s funds sit."
        />
        <div className="mt-8">
          <ConstraintLedger snapshot={snapshot} profile={runtime.policyProfile} />
        </div>
        <div className="mt-10 grid gap-10 border-t border-rule pt-10 lg:grid-cols-[0.95fr_1.05fr]">
          <AquaBalances snapshot={snapshot} profile={runtime.policyProfile} />
          <FlowTrace snapshot={snapshot} execution={execution} profile={runtime.policyProfile} />
        </div>
      </section>
      <section id="agent-run" className="mt-16" aria-label="Agent run">
        <SectionHead
          num="02"
          title="Run the constrained agent"
          lede={
            runtime.local
              ? "Local mode retains the manually injected agent-wallet execution path."
              : "Sepolia runs only the bounded server-side agent; the browser supplies no calldata and holds no signer."
          }
        />
        <div className="mt-8">
          {runtime.local ? (
            <SimulationGate
              snapshot={snapshot}
              runtime={runtime}
              onSubmitted={(submittedHash) => {
                setTxHash(submittedHash);
                setTransactionState("SUBMITTED");
              }}
            />
          ) : (
            <AgentRun
              snapshot={snapshot}
              runtime={runtime}
              onConfirmed={(nextExecution, nextAudit) => {
                setExecution(nextExecution);
                setAudit(nextAudit);
                setTxHash(nextExecution.txHash);
                setTransactionState(undefined);
              }}
            />
          )}
        </div>
      </section>
      <section id="evidence" className="mt-16" aria-label="Evidence">
        <SectionHead
          num="03"
          title="Verify the evidence"
          lede="Canonical Sepolia execution and recorded Ethereum mainnet route assurance remain separate, inspectable proof lanes."
        />
        <div className="mt-8 grid gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <ReceiptPlate
            snapshot={snapshot}
            execution={execution}
            audit={audit}
            transactionState={transactionState}
            profile={runtime.policyProfile}
          />
          <StrategyFields snapshot={snapshot} />
        </div>
        <div className="mt-10">
          <BazanticLane proof={bazanticProof} />
        </div>
      </section>
      <section id="safety" className="mt-16 border-t border-rule pt-14" aria-label="Stop authority">
        <SectionHead
          num="04"
          title="Stop authority"
          lede="The owner can revoke the mandate or dock its Aqua allocation; ENS identity expiry is an independent fail-closed boundary."
          accent={snapshot.state.revoked ? "revoked" : undefined}
        />
        {!runtime.local && (
          <div className="mt-6">
            <Button variant="ghost" onClick={() => setManageAuthority((open) => !open)}>
              {manageAuthority ? "Close authority controls" : "Manage authority"}
            </Button>
          </div>
        )}
        <div className="mt-8">
          {runtime.local ? (
            <Revocation
              snapshot={snapshot}
              runtime={runtime}
              onSubmitted={() => window.setTimeout(() => void refresh(), 1_000)}
            />
          ) : manageAuthority ? (
            <OwnerControls
              snapshot={snapshot}
              mandateApp={runtime.mandateApp}
              onSubmitted={() => window.setTimeout(() => void refresh(), 1_000)}
            />
          ) : (
            <p className="lede">Open Manage authority to load the owner smart-account controls.</p>
          )}
        </div>
      </section>
    </div>
  );
}
