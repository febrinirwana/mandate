"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { ArrowRight, ChevronDown, LockKeyhole, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { keccak256, stringToHex } from "viem";

import { Button } from "@/components/ui/kit";
import { CopyValue } from "@/components/ui/copy-value";
import { compilePolicy, type PolicyDraftV1 } from "@/lib/policy";
import { strategyHash } from "@/lib/mandate";
import type { MandateRuntime } from "@/lib/runtime.server";

type ProposalState =
  | { kind: "IDLE" }
  | { kind: "DRAFTING" }
  | { kind: "CLARIFICATION"; message: string }
  | { kind: "UNAVAILABLE" };


export function AuthorityComposer({ runtime }: { runtime: MandateRuntime }) {
  const { authenticated, login, ready } = usePrivy();
  const { client } = useSmartWallets();
  const [intent, setIntent] = useState("");
  const [draft, setDraft] = useState<PolicyDraftV1>();
  const [proposalState, setProposalState] = useState<ProposalState>({ kind: "IDLE" });
  const [validAfter, setValidAfter] = useState("");
  const [salt, setSalt] = useState<`0x${string}`>();

  const maker = client?.account.address?.toLowerCase() as `0x${string}` | undefined;
  const strategy = useMemo(() => {
    if (!draft || !runtime.policyProfile || !maker || !validAfter || !salt) return undefined;
    try {
      return compilePolicy(draft, runtime.policyProfile, { maker, validAfter, salt });
    } catch {
      return undefined;
    }
  }, [draft, maker, runtime.policyProfile, salt, validAfter]);
  const hash = strategy ? strategyHash(strategy) : undefined;

  const draftAuthority = async () => {
    if (!intent.trim()) {
      setProposalState({ kind: "CLARIFICATION", message: "Name the agent, asset pair, cap, protection, and expiry." });
      return;
    }
    setProposalState({ kind: "DRAFTING" });
    try {
      const response = await fetch("/api/policy-proposals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ intent }),
      });
      const result = await response.json() as { kind?: string; proposal?: PolicyDraftV1; message?: string };
      if (result.kind === "PROPOSAL" && result.proposal) {
        setDraft(result.proposal);
        setValidAfter(String(Math.floor(Date.now() / 1000)));
        setSalt(keccak256(stringToHex(crypto.randomUUID())));
        setProposalState({ kind: "IDLE" });
        return;
      }
      setProposalState(result.kind === "UNAVAILABLE" ? { kind: "UNAVAILABLE" } : { kind: "CLARIFICATION", message: result.message ?? "I need a clearer authority." });
    } catch {
      setProposalState({ kind: "UNAVAILABLE" });
    }
  };

  const updateDraft = (field: keyof PolicyDraftV1, value: string) => {
    setDraft((current) => current ? { ...current, [field]: value } : current);
    setSalt(keccak256(stringToHex(crypto.randomUUID())));
  };

  if (!runtime.privyEnabled) {
    return <section className="mx-auto max-w-[1440px] border-x border-rule px-6 py-24 lg:px-10"><p className="ledger-label text-ink-3">Secure wallet unavailable</p><h1 className="display mt-4 text-[clamp(2rem,4vw,3.25rem)]">Privy needs a public App ID.</h1><p className="lede mt-4 max-w-[56ch]">Add NEXT_PUBLIC_PRIVY_APP_ID to the web runtime, restart Next, and return here. No owner authority can be prepared without an authenticated wallet.</p></section>;
  }

  if (!runtime.policyProfile) {
    return <section className="mx-auto max-w-[1440px] border-x border-rule px-6 py-24 lg:px-10"><p className="ledger-label text-ink-3">Authority profile unavailable</p><h1 className="display mt-4 text-[clamp(2rem,4vw,3.25rem)]">No trusted route is configured.</h1><p className="lede mt-4 max-w-[56ch]">Mandate will not guess an agent, token pair, ENS identity, or venue. Configure MANDATE_POLICY_PROFILE with the verified Sepolia strategy profile before issuing authority.</p></section>;
  }

  return <div className="mx-auto max-w-[1440px] border-x border-rule">
    <section className="grid gap-8 border-b border-rule px-6 py-8 lg:grid-cols-[1fr_auto] lg:px-10">
      <div><p className="ledger-label text-ink-3">Authority composer · Sepolia</p><h1 className="display mt-3 text-[clamp(2.5rem,5vw,4.5rem)]">Give an agent a boundary, not your keys.</h1></div>
      <div className="self-start border border-rule bg-raised px-4 py-3 text-right"><p className="ledger-label text-ink-3">Secure owner</p><p className="mono-data mt-1">{!ready ? "Preparing Privy…" : !authenticated ? "Not signed in" : maker ? `${maker.slice(0, 6)}…${maker.slice(-4)}` : "Preparing smart wallet…"}</p></div>
    </section>

    <main className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.72fr)]">
      <section className="border-b border-rule px-6 py-10 lg:border-b-0 lg:border-r lg:px-10 lg:py-14">
        <p className="ledger-label text-ink-3">Describe the boundary</p>
        <label className="mt-4 block"><span className="sr-only">Describe authority</span><textarea aria-label="Describe authority" value={intent} onChange={(event) => setIntent(event.target.value)} placeholder="Let Nova swap up to 1,000 USDC for WETH until Friday, never below 0.001 WETH per USDC." className="display min-h-42 w-full resize-none border-y border-rule bg-transparent py-5 text-[clamp(1.55rem,3.2vw,2.75rem)] leading-[1.08] outline-none placeholder:text-ink-3" /></label>
        <div className="mt-5 flex flex-wrap items-center gap-3"><Button onClick={() => void draftAuthority()} disabled={proposalState.kind === "DRAFTING"}><Sparkles size={16} aria-hidden="true" />{proposalState.kind === "DRAFTING" ? "Drafting boundary…" : "Draft authority"}</Button>{["1,000 USDC to WETH until Friday", "Nova · 500 USDC · 0.001 WETH/USDC"].map((example) => <button key={example} type="button" onClick={() => setIntent(`Let ${example}.`)} className="min-h-11 border border-rule px-3 text-left text-[0.8125rem] text-ink-2 transition-colors hover:border-accent hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">Try: {example}</button>)}</div>
        {proposalState.kind === "CLARIFICATION" && <p role="status" className="mono-data mt-4 text-revoked">{proposalState.message}</p>}
        {proposalState.kind === "UNAVAILABLE" && <p role="status" className="mono-data mt-4 text-revoked">Policy drafting is unavailable. Your wallet is never affected; try again when the server model is configured.</p>}

        {draft && <div className="mt-12 border-t border-rule pt-6"><div className="flex items-baseline justify-between gap-4"><h2 className="text-[1.125rem] font-medium">Tune the boundary</h2><p className="ledger-label text-ink-3">Every edit invalidates approval</p></div><div className="mt-6 grid gap-5 sm:grid-cols-2">
          <label className="grid gap-2"><span className="ledger-label text-ink-3">Agent</span><input aria-label="Agent" className="min-h-11 border border-rule bg-raised px-3" value={draft.agent} onChange={(event) => updateDraft("agent", event.target.value)} /></label>
          <label className="grid gap-2"><span className="ledger-label text-ink-3">Maximum spend</span><div className="flex border border-rule bg-raised"><input aria-label="Maximum spend" inputMode="decimal" className="min-h-11 min-w-0 flex-1 bg-transparent px-3" value={draft.maxInput} onChange={(event) => updateDraft("maxInput", event.target.value)} /><span className="mono-data flex items-center pr-3 text-ink-3">{draft.tokenIn}</span></div></label>
          <label className="grid gap-2"><span className="ledger-label text-ink-3">Minimum output rate</span><input aria-label="Minimum output rate" inputMode="decimal" className="min-h-11 border border-rule bg-raised px-3" value={draft.minRate} onChange={(event) => updateDraft("minRate", event.target.value)} /></label>
          <label className="grid gap-2"><span className="ledger-label text-ink-3">Expiry</span><input aria-label="Expiry" type="datetime-local" className="min-h-11 border border-rule bg-raised px-3" value={draft.expiresAt.slice(0, 16)} onChange={(event) => updateDraft("expiresAt", new Date(event.target.value).toISOString())} /></label>
        </div></div>}
      </section>

      <aside className="bg-raised px-6 py-10 lg:px-8 lg:py-14">
        <p className="ledger-label text-ink-3">Reviewable authority</p>
        {draft ? <><div className="mt-5 border border-rule bg-paper p-5"><p className="ledger-label text-accent">Proposed · not authorized</p><h2 className="mt-4 text-[1.65rem] leading-[1.08] tracking-[-0.03em]">{draft.agent} may convert up to {draft.maxInput} {draft.tokenIn} into {draft.tokenOut}.</h2><dl className="mt-7 grid gap-4 border-t border-rule pt-5"><div className="flex justify-between gap-4"><dt className="ledger-label text-ink-3">Price floor</dt><dd className="mono-data text-right">{draft.minRate} {draft.tokenOut} / {draft.tokenIn}</dd></div><div className="flex justify-between gap-4"><dt className="ledger-label text-ink-3">Expires</dt><dd className="mono-data text-right">{new Date(draft.expiresAt).toLocaleString()}</dd></div><div className="flex justify-between gap-4"><dt className="ledger-label text-ink-3">Destination</dt><dd className="mono-data text-right">Owner smart wallet only</dd></div></dl></div>
          {strategy && hash ? <details className="group mt-5 border-y border-rule"><summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 py-3 text-[0.9375rem] font-medium">Exact onchain authority<ChevronDown size={16} className="transition-transform group-open:rotate-180" aria-hidden="true" /></summary><div className="space-y-3 border-t border-rule py-4"><CopyValue value={hash} /><p className="mono-data break-all text-[0.6875rem] leading-5 text-ink-2">{strategy.tokenIn} → {strategy.tokenOut}<br />{strategy.swapTarget} · {strategy.swapSelector}<br />max {strategy.maxInputTotal} base units · valid until {strategy.validUntil}</p></div></details> : <p role="status" className="mono-data mt-5 text-revoked">This draft does not match the trusted authority profile. Adjust the highlighted policy terms.</p>}</> : <div className="mt-5 border border-dashed border-rule p-5"><p className="text-[1.125rem] font-medium">Your authority will appear here.</p><p className="mono-data mt-3 leading-5 text-ink-2">AI drafts a proposal. You edit it. Mandate compiles the immutable onchain boundary.</p></div>}
        <div className="mt-8 border-t border-rule pt-5"><p className="mono-data leading-5 text-ink-2"><LockKeyhole className="mr-2 inline" size={14} aria-hidden="true" />No custody transfer. Simulation and receipt confirmation are required before an authority becomes active.</p>{!authenticated ? <Button className="mt-5 w-full" onClick={() => login()} disabled={!ready}>Create secure wallet<ArrowRight size={16} aria-hidden="true" /></Button> : <Button className="mt-5 w-full" disabled>Simulation required before authorization</Button>}</div>
      </aside>
    </main>
  </div>;
}
