"use client";

import Link from "next/link";
import { CaretRight as PhCaretRight } from "@phosphor-icons/react/dist/ssr";
import { useState } from "react";
import { AuthorityHeader } from "@/components/mandate/authority-header";
import { AquaBalances } from "@/components/mandate/aqua-balances";
import { ConstraintLedger } from "@/components/mandate/constraint-ledger";
import { FlowTrace } from "@/components/mandate/flow-trace";
import { ReceiptPlate } from "@/components/mandate/receipt-plate";
import { Revocation, type Path } from "@/components/mandate/revocation";
import { SimulationGate } from "@/components/mandate/simulation-gate";
import { StrategyFields } from "@/components/mandate/strategy-fields";
import { Button } from "@/components/ui/kit";
import { CopyValue } from "@/components/ui/copy-value";
import { Reveal } from "@/components/ui/reveal";
import { Stamp } from "@/components/ui/kit";
import { DEMO_STRATEGY_HASH } from "@/lib/demo";

/**
 * Full inspection surface. Demo mode: synthetic state, real interactions
 * (simulation replay, revocation state flip), honest fail-closed handling
 * for unknown hashes.
 */
export function MandateInspector({ hash, resolved }: { hash: string; resolved: boolean }) {
  const [revoked, setRevoked] = useState(false);

  const revoke = (path: Path) => {
    if (path === "mandate") setRevoked(true);
  };

  if (!resolved) {
    return (
      <div className="mx-auto max-w-[1440px] border-x border-rule px-6 py-24 lg:px-10">
        <h1 className="display text-[clamp(2rem,4vw,3.25rem)]">UNKNOWN — mandate not resolved</h1>
        <p className="lede mt-4 max-w-[60ch]">
          This inspection route only resolves mandates this deployment knows. An unknown strategy hash
          fails closed: no status, no assumptions, no cached green state.
        </p>
        <div className="mono-data mt-6">
          <CopyValue value={hash || "—"} />
        </div>
        <div className="mt-8">
          <Button onClick={() => (window.location.href = `/mandates/${DEMO_STRATEGY_HASH}`)}>
            Open the demo mandate
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1440px] border-x border-rule px-6 py-10 lg:px-10 lg:py-14">
      {/* breadcrumb */}
      <nav aria-label="Breadcrumb" className="mono-data flex items-center gap-2 text-ink-3">
        <Link href="/" className="link-quiet hover:text-ink">
          mandates
        </Link>
        <PhCaretRight size={12} aria-hidden="true" />
        <CopyValue value={hash} />
      </nav>

      <div className="mono-data mt-6 flex flex-wrap items-center gap-3" style={{ color: "var(--expiring)" }}>
        <Stamp kind="EXPIRING" label="SAMPLE — synthetic demo state, not live chain data" />
        <span className="text-ink-3">
          A live deployment performs every read below onchain; unknown fails closed.
        </span>
      </div>

      <div className="mt-6">
        <AuthorityHeader
          status={revoked ? "REVOKED" : "ACTIVE"}
          sentence="May convert USDC → WETH through 1inch Aggregation Router v6, capped per call and in total, output pushed back to the treasury."
        />
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1.35fr_0.65fr]">
        <Reveal>
          <ConstraintLedger stopped={revoked} />
        </Reveal>
        <Reveal delay={0.06}>
          <AquaBalances />
        </Reveal>
      </div>

      <div id="simulate" className="mt-12 border-t border-rule-strong pt-8">
        <Reveal>
          <SimulationGate stopped={revoked} />
        </Reveal>
      </div>

      <div className="mt-12 grid gap-10 lg:grid-cols-2">
        <Reveal>
          <FlowTrace stopped={revoked} estimate={!revoked} />
        </Reveal>
        <Reveal delay={0.06}>
          <ReceiptPlate />
        </Reveal>
      </div>

      <div id="revoke" className="mt-12 border-t border-rule-strong pt-8">
        <Reveal>
          <Revocation revoked={revoked} onRevoke={revoke} />
        </Reveal>
      </div>

      <div id="fields" className="mt-12 border-t border-rule-strong pt-2">
        <StrategyFields />
      </div>
    </div>
  );
}
