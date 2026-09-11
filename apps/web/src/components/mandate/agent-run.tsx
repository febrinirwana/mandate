"use client";

import type {
  DemoExecutionResultV1,
  ExecutionV1,
  MandateSnapshotV1,
  ReceiptAuditV1,
} from "@mandate/domain";
import { Play } from "lucide-react";
import { useState } from "react";

import { Button, Stamp } from "@/components/ui/kit";
import { inspectionStatus } from "@/lib/mandate";
import { runDemoAgent, type ApiState } from "@/lib/api";
import type { MandateRuntime } from "@/lib/runtime.server";

export type AgentRunState = "WAITING" | "RUNNING" | "PASS" | "FAIL" | "UNKNOWN";

export function parseInitialReceiptHash(value: string | undefined): `0x${string}` | undefined {
  return value && /^0x[0-9a-fA-F]{64}$/.test(value)
    ? (value.toLowerCase() as `0x${string}`)
    : undefined;
}

export function toAgentRunState(result: ApiState<DemoExecutionResultV1>): AgentRunState {
  if (result.kind !== "READY") return "UNKNOWN";
  if (result.data.status === "CONFIRMED") return "PASS";
  return result.data.status === "REJECTED" ? "FAIL" : "UNKNOWN";
}

function rejectionMessage(reason: string): string {
  if (reason === "ROUTE_CALL_FAILED") {
    return "the fixed venue cannot satisfy this authority’s minimum output at the requested amount";
  }
  if (reason === "TOTAL_CAP_EXCEEDED") {
    return "the authority’s total spend cap is already exhausted";
  }
  if (reason === "MANDATE_EXPIRED") return "the authority has expired";
  if (reason === "MANDATE_REVOKED") return "the owner revoked this authority";
  return reason.replaceAll("_", " ").toLowerCase();
}

export function AgentRun({
  snapshot,
  runtime,
  onConfirmed,
}: {
  snapshot: MandateSnapshotV1;
  runtime: MandateRuntime;
  onConfirmed: (execution: ExecutionV1, audit: ReceiptAuditV1) => void;
}) {
  const [state, setState] = useState<AgentRunState>("WAITING");
  const [message, setMessage] = useState(
    "Read the current authority before starting the constrained server-side agent.",
  );
  const eligible =
    inspectionStatus(snapshot) === "ACTIVE" &&
    snapshot.aqua.result === "PASS" &&
    BigInt(snapshot.state.usedInput) < BigInt(snapshot.strategy.maxInputTotal);

  async function run() {
    setState("RUNNING");
    setMessage(
      "Reading authority, simulating the exact route, then waiting for the Sepolia receipt…",
    );
    const result = await runDemoAgent({
      chainId: runtime.chainId,
      strategyHash: snapshot.strategyHash,
    });
    const next = toAgentRunState(result);
    setState(next);
    if (result.kind !== "READY") {
      setMessage(
        "UNKNOWN: the agent response was unavailable or invalid. No execution is treated as confirmed.",
      );
      return;
    }
    if (result.data.status === "REJECTED") {
      setMessage(`FAIL: ${rejectionMessage(result.data.reason)}. No execution was submitted.`);
      return;
    }
    if (result.data.status === "UNKNOWN") {
      setMessage(`UNKNOWN: ${result.data.errorId}. No execution is treated as confirmed.`);
      return;
    }

    onConfirmed(result.data.execution, result.data.audit);
    const query = new URLSearchParams(window.location.search);
    query.set("tx", result.data.txHash);
    window.history.replaceState(null, "", `${window.location.pathname}?${query}`);
    setMessage("PASS: canonical receipt and compliance audit returned by the constrained agent.");
  }

  const steps = [
    "Read live authority",
    "Verify ENS agent",
    "Simulate exact route",
    "Submit bounded call",
    "Prove canonical receipt",
  ];
  const stepLabel =
    state === "WAITING"
      ? "PENDING"
      : state === "RUNNING"
        ? "CHECKING"
        : state === "PASS"
          ? "PASS"
          : state;

  return (
    <div className="overflow-hidden border border-rule bg-raised">
      <div className="grid gap-6 bg-ink p-6 text-paper sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <p className="ledger-label text-paper/55">Sepolia authority execution</p>
          <h3 className="mt-2 text-[1.65rem] font-medium tracking-[-0.035em]">
            Constrained demo agent
          </h3>
          <p className="mt-2 max-w-[62ch] text-sm text-paper/65">
            Send only the chain ID and strategy hash. The dedicated agent independently reads the
            authority, reconstructs and simulates the permitted call, signs it, then returns the
            canonical Sepolia receipt. Slow RPCs can make this take about one minute.
          </p>
        </div>
        <Stamp
          kind={state === "PASS" ? "PASS" : state === "FAIL" ? "FAILED" : "UNKNOWN"}
          label={state}
          className="self-start"
        />
      </div>
      <ol className="grid border-b border-rule sm:grid-cols-5" aria-label="Agent execution gates">
        {steps.map((step, index) => (
          <li
            key={step}
            className="relative min-h-28 border-b border-rule p-4 last:border-0 sm:border-b-0 sm:border-r"
          >
            <span className="mono-data text-ink-3">{String(index + 1).padStart(2, "0")}</span>
            <strong className="mt-4 block text-sm font-medium">{step}</strong>
            <span
              className={`mono-data mt-2 block text-[0.6875rem] ${
                state === "PASS"
                  ? "text-confirmed"
                  : state === "FAIL"
                    ? "text-revoked"
                    : state === "RUNNING"
                      ? "text-accent"
                      : "text-ink-3"
              }`}
            >
              {stepLabel}
            </span>
          </li>
        ))}
      </ol>
      <div className="p-6">
        <p role="status" className="mono-data text-ink-2">
          {message}
        </p>
        <Button
          className="mt-6"
          disabled={!eligible || state === "RUNNING"}
          onClick={() => void run()}
        >
          <Play size={14} aria-hidden="true" />
          {state === "RUNNING" ? "Running constrained execution" : "Run bounded demo execution"}
        </Button>
        {!eligible && (
          <p className="mono-data mt-3 text-revoked">
            FAIL: authority is not currently eligible for execution.
          </p>
        )}
      </div>
    </div>
  );
}
