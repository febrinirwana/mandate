"use client";

import { StrategyV1Schema, type StrategyV1 } from "@mandate/domain";
import { ExternalLink, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import type { Address } from "viem";

import { Button } from "@/components/ui/kit";
import { CopyValue } from "@/components/ui/copy-value";
import { strategyHash } from "@/lib/mandate";
import type { MandateRuntime } from "@/lib/runtime.server";
import {
  activateStrategy,
  approveAqua,
  confirmSubmitted,
  readAquaAddress,
  shipStrategy,
  type WalletState,
} from "@/lib/wallet";

type StrategyInput = Omit<StrategyV1, "version">;
type Operation = "inputApproval" | "outputApproval" | "ship" | "activate";

const fields = [
  "maker", "agent", "ensRegistry", "ensResolver", "ensLabel", "ensNode", "tokenIn", "tokenOut", "swapTarget", "swapSelector", "minRateNumerator", "minRateDenominator", "maxInputPerCall", "maxInputTotal", "validAfter", "validUntil", "salt",
] as const;

const emptyStrategy: StrategyInput = {
  maker: "" as Address,
  agent: "" as Address,
  ensRegistry: "" as Address,
  ensResolver: "" as Address,
  ensLabel: "",
  ensNode: "" as `0x${string}`,
  tokenIn: "" as Address,
  tokenOut: "" as Address,
  swapTarget: "" as Address,
  swapSelector: "" as `0x${string}`,
  minRateNumerator: "",
  minRateDenominator: "",
  maxInputPerCall: "",
  maxInputTotal: "",
  validAfter: "",
  validUntil: "",
  salt: "" as `0x${string}`,
};

const initialOperations: Record<Operation, WalletState> = {
  inputApproval: { kind: "IDLE" },
  outputApproval: { kind: "IDLE" },
  ship: { kind: "IDLE" },
  activate: { kind: "IDLE" },
};

function operationText(state: WalletState): string {
  if (state.kind === "SUBMITTED") return `SUBMITTED: ${state.txHash}. Submitted is not confirmed.`;
  if (state.kind === "CONFIRMED") return `CONFIRMED: ${state.txHash}.`;
  if (state.kind === "REJECTED") return "Wallet rejected. Validated form and completed sequence steps remain intact.";
  if (state.kind === "WRONG_CHAIN") return `Wrong chain: ${state.actual}.`;
  if (state.kind === "WRONG_ACCOUNT") return `Wrong owner account: ${state.actual}.`;
  if (state.kind === "REVERTED") return `REVERTED: ${state.message}`;
  if (state.kind === "UNAVAILABLE") return "Wallet unavailable.";
  return "Not submitted.";
}

export function Issuance({ runtime }: { runtime: MandateRuntime | null }) {
  const [form, setForm] = useState<StrategyInput>(emptyStrategy);
  const [aqua, setAqua] = useState<Address>();
  const [operations, setOperations] = useState(initialOperations);

  useEffect(() => {
    const saved = sessionStorage.getItem("mandate:issuance:v1");
    if (!saved) return;
    try {
      const parsed = StrategyV1Schema.safeParse({ version: 1, ...JSON.parse(saved) });
      if (parsed.success) setForm(parsed.data);
    } catch {
      sessionStorage.removeItem("mandate:issuance:v1");
    }
  }, []);
  useEffect(() => {
    sessionStorage.setItem("mandate:issuance:v1", JSON.stringify(form));
  }, [form]);

  const strategy = StrategyV1Schema.safeParse({ version: 1, ...form });
  const hash = strategy.success ? strategyHash(strategy.data) : undefined;
  const update = (field: keyof StrategyInput, value: string) => setForm((current) => ({ ...current, [field]: value }));
  const setOperation = (operation: Operation, state: WalletState) => setOperations((current) => ({ ...current, [operation]: state }));
  const readAqua = async () => {
    if (!runtime) return;
    setAqua((await readAquaAddress(runtime.mandateApp)) ?? undefined);
  };
  const approve = async (operation: "inputApproval" | "outputApproval", token: Address, amount: string) => {
    if (!runtime || !strategy.success || !aqua) return;
    setOperation(operation, await approveAqua(runtime.chainId, strategy.data.maker, aqua, token, amount));
  };
  const ship = async () => {
    if (!runtime || !strategy.success || !aqua) return;
    setOperation("ship", await shipStrategy(runtime.chainId, strategy.data.maker, aqua, runtime.mandateApp, strategy.data));
  };
  const activate = async () => {
    if (!runtime || !strategy.success) return;
    setOperation("activate", await activateStrategy(runtime.chainId, strategy.data.maker, runtime.mandateApp, strategy.data));
  };
  const confirm = async (operation: Operation) => {
    setOperation(operation, await confirmSubmitted(operations[operation]));
  };

  if (!runtime) return <div className="mx-auto max-w-[1440px] border-x border-rule px-6 py-24 lg:px-10"><h1 className="display text-[clamp(2rem,4vw,3.25rem)]">Runtime unavailable</h1><p className="lede mt-4">Issuance cannot prepare a transaction without an explicit chain and Mandate app configuration.</p></div>;

  return <div className="mx-auto max-w-[1440px] border-x border-rule px-6 py-10 lg:px-10 lg:py-14">
    <p className="ledger-label text-ink-3">Owner issuance · chain {runtime.chainId}</p>
    <h1 className="display mt-4 text-[clamp(2.5rem,5vw,4.5rem)]">Issue a narrow authority.</h1>
    <p className="lede mt-5 max-w-[66ch]">Four explicit owner steps: validate the exact StrategyV1, verify the existing ENSv2 binding, approve Aqua, then ship and activate the same ABI bytes. No owner key leaves the wallet.</p>

    <section className="mt-14 border-t border-rule pt-6" aria-labelledby="issue-step-1"><h2 id="issue-step-1" className="text-[1.25rem] font-medium">01 · Identity and exact strategy</h2><p className="mono-data mt-2 text-ink-2">ENS setup is an owner-controlled prerequisite. The onchain execution check requires current registry owner, resolver, and address to match this exact agent.</p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">{fields.map((field) => <label key={field} className="grid gap-1.5"><span className="ledger-label text-ink-3">{field}</span><input aria-label={field} className="mono-data min-h-11 border border-rule bg-raised px-3" value={form[field]} onChange={(event) => update(field, event.target.value)} /></label>)}</div>
      {!strategy.success && <ul className="mono-data mt-5 space-y-1 text-revoked" aria-live="polite">{strategy.error.issues.map((issue, index) => <li key={`${issue.path.join(".")}-${index}`}>{issue.path.join(".") || "strategy"}: {issue.message}</li>)}</ul>}
      {strategy.success && <div className="mt-5 border border-rule bg-raised p-4"><p className="mono-data font-medium text-accent">VALID StrategyV1 · immutable hash</p><CopyValue value={hash ?? ""} className="mt-2" /><p className="mono-data mt-3 text-ink-2">Human summary: {strategy.data.agent} may convert {strategy.data.tokenIn} → {strategy.data.tokenOut}; at most {strategy.data.maxInputPerCall} base units per execution and {strategy.data.maxInputTotal} total, until unix {strategy.data.validUntil}. Output returns only to {strategy.data.maker}.</p></div>}
    </section>

    <section className="mt-14 border-t border-rule pt-6" aria-labelledby="issue-step-2"><h2 id="issue-step-2" className="text-[1.25rem] font-medium">02 · ABI review and Aqua address</h2><p className="mono-data mt-2 text-ink-2">The human review and every exact base-unit ABI field are shown together. Wallet reads the immutable Aqua address from the configured Mandate app.</p><Button variant="ghost" className="mt-5" onClick={() => void readAqua()}><RefreshCw size={14} aria-hidden="true" />Read Aqua address</Button>{aqua && <CopyValue value={aqua} className="mt-4" />}</section>

    <section className="mt-14 border-t border-rule pt-6" aria-labelledby="issue-step-3">
      <h2 id="issue-step-3" className="text-[1.25rem] font-medium">03 · Exact Aqua approvals</h2>
      <p className="mono-data mt-2 text-ink-2">Each wallet prompt is constrained to an ERC-20 approve to the Aqua address read above. Rejection preserves this validated form.</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Button disabled={!strategy.success || !aqua} onClick={() => strategy.success && void approve("inputApproval", strategy.data.tokenIn, strategy.data.maxInputTotal)}>Approve tokenIn exact total</Button>
        <Button variant="ghost" disabled={!strategy.success || !aqua} onClick={() => strategy.success && void approve("outputApproval", strategy.data.tokenOut, "0")}>Set tokenOut approval to zero</Button>
        <Button variant="ghost" disabled={operations.inputApproval.kind !== "SUBMITTED"} onClick={() => void confirm("inputApproval")}>Confirm input approval receipt</Button>
        <Button variant="ghost" disabled={operations.outputApproval.kind !== "SUBMITTED"} onClick={() => void confirm("outputApproval")}>Confirm output approval receipt</Button>
      </div>
      <p role="status" className="mono-data mt-3 text-ink-2">input: {operationText(operations.inputApproval)}</p>
      <p role="status" className="mono-data mt-1 text-ink-2">output: {operationText(operations.outputApproval)}</p>
    </section>

    <section className="mt-14 border-y border-rule py-6" aria-labelledby="issue-step-4">
      <h2 id="issue-step-4" className="text-[1.25rem] font-medium">04 · Ship then activate</h2>
      <p className="mono-data mt-2 text-ink-2">Ship includes both token addresses and `[maxInputTotal, 0]`; activation repeats the same typed StrategyV1. Do not advance on a submitted state alone.</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Button disabled={!strategy.success || !aqua || operations.inputApproval.kind !== "CONFIRMED" || operations.outputApproval.kind !== "CONFIRMED"} onClick={() => void ship()}>Ship strategy through Aqua</Button>
        <Button variant="ghost" disabled={operations.ship.kind !== "SUBMITTED"} onClick={() => void confirm("ship")}>Confirm ship receipt</Button>
        <Button variant="carbon" disabled={!strategy.success || operations.ship.kind !== "CONFIRMED"} onClick={() => void activate()}>Activate Mandate</Button>
        <Button variant="ghost" disabled={operations.activate.kind !== "SUBMITTED"} onClick={() => void confirm("activate")}>Confirm activation receipt</Button>
      </div>
      <p role="status" className="mono-data mt-3 text-ink-2">ship: {operationText(operations.ship)}</p>
      <p role="status" className="mono-data mt-1 text-ink-2">activate: {operationText(operations.activate)}</p>
      {hash && operations.activate.kind === "CONFIRMED" && <a href={`/mandates/${hash}`} className="mt-6 inline-flex min-h-11 items-center gap-2 text-[0.9375rem] font-medium text-accent">Inspect confirmed strategy<ExternalLink size={14} aria-hidden="true" /></a>}
    </section>
  </div>;
}
