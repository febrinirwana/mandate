"use client";

import Link from "next/link";
import { ChevronRight, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { Hex } from "viem";

import { AquaBalances } from "@/components/mandate/aqua-balances";
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

type InspectionState =
  | { kind: "LOADING" }
  | { kind: "READY"; snapshot: MandateSnapshotV1 }
  | { kind: "UNKNOWN"; reason: string };

export function MandateInspector({
  hash,
  runtime,
}: {
  hash: string;
  runtime: MandateRuntime | null;
}) {
  const [state, setState] = useState<InspectionState>({ kind: "LOADING" });
  const [stale, setStale] = useState(false);
  const [txHash, setTxHash] = useState<Hex>();
  const [execution, setExecution] = useState<ExecutionV1>();
  const [audit, setAudit] = useState<ReceiptAuditV1>();
  const [transactionState, setTransactionState] = useState<"SUBMITTED" | "REVERTED" | "REORGED">();

  const refresh = useCallback(async () => {
    setStale(false);
    if (!runtime || !/^0x[0-9a-fA-F]{64}$/.test(hash)) {
      setState({ kind: "UNKNOWN", reason: "Runtime configuration or strategy hash is invalid." });
      return;
    }
    setState({ kind: "LOADING" });
    const result = await readMandate(runtime.chainId, hash.toLowerCase());
    if (result.kind === "READY") {
      setState({ kind: "READY", snapshot: result.data });
      return;
    }
    setState({
      kind: "UNKNOWN",
      reason:
        result.kind === "NOT_FOUND"
          ? "No activated strategy was found for this hash."
          : "RPC/API state is unavailable or invalid. No green state is cached.",
    });
  }, [hash, runtime]);

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
    if (state.kind !== "READY") return;
    const timer = window.setTimeout(() => setStale(true), 30_000);
    return () => window.clearTimeout(timer);
  }, [state]);
  useEffect(() => {
    if (!runtime || !txHash) return;
    const timer = window.setTimeout(() => void loadReceipt(runtime.chainId, txHash), 1_000);
    return () => window.clearTimeout(timer);
  }, [loadReceipt, runtime, txHash]);

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
      <div className="mt-10 grid grid-cols-[minmax(0,1fr)] items-end gap-12 border-b border-rule pb-14 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]">
        <div>
          <AuthorityHeader
            snapshot={snapshot}
            sentence="The named agent may execute only this immutable token conversion. Treasury custody remains with the maker between actions."
          />
          {stale && (
            <p role="status" className="mono-data mt-4 text-unknown">
              UNKNOWN: this snapshot is stale. Refresh before relying on state.
            </p>
          )}
          <Button variant="ghost" className="mt-5" onClick={() => void refresh()}>
            <RefreshCw size={14} aria-hidden="true" />
            Refresh block-stamped state
          </Button>
        </div>
        <OrderSummary snapshot={snapshot} />
      </div>
      <section className="mt-20" aria-label="Constraints">
        <SectionHead
          num="01"
          title="Constraints"
          lede="Exact strategy values and current cap use come from the same block-stamped API response."
        />
        <div className="mt-8">
          <ConstraintLedger snapshot={snapshot} />
        </div>
      </section>
      <section className="mt-20" aria-label="Settlement">
        <SectionHead
          num="02"
          title="Settlement"
          lede="Physical ERC-20 balances and Aqua's virtual strategy lane are distinct ledgers."
        />
        <div className="mt-8 grid gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          <AquaBalances snapshot={snapshot} />
          <FlowTrace snapshot={snapshot} execution={execution} />
        </div>
      </section>
      <section id="simulate" className="mt-20" aria-label="Simulation">
        <SectionHead
          num="03"
          title="Simulation"
          lede="Simulation is advisory. The exact agent wallet submits only a generated Mandate execute call after a current PASS."
        />
        <div className="mt-8">
          <SimulationGate
            snapshot={snapshot}
            runtime={runtime}
            onSubmitted={(submittedHash) => {
              setTxHash(submittedHash);
              setTransactionState("SUBMITTED");
            }}
          />
        </div>
      </section>
      <section className="mt-20" aria-label="Evidence">
        <SectionHead
          num="04"
          title="Evidence"
          lede="Only canonical receipt evidence may say confirmed. Submitted remains submitted until the API verifies the receipt."
        />
        <div className="mt-8 grid gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <ReceiptPlate
            snapshot={snapshot}
            execution={execution}
            audit={audit}
            transactionState={transactionState}
          />
          <StrategyFields snapshot={snapshot} />
        </div>
      </section>
      <section id="revoke" className="mt-20" aria-label="Stop authority">
        <SectionHead
          num="05"
          title="Stop authority"
          lede="Mandate revoke, Aqua dock, and ENS identity change are independent owner stop paths."
          accent={snapshot.state.revoked ? "revoked" : undefined}
        />
        <div className="mt-8">
          <Revocation
            snapshot={snapshot}
            runtime={runtime}
            onSubmitted={() => window.setTimeout(() => void refresh(), 1_000)}
          />
        </div>
      </section>
    </div>
  );
}
