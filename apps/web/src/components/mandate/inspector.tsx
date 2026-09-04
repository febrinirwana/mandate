"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { AquaBalances } from "@/components/mandate/aqua-balances";
import { ConstraintLedger } from "@/components/mandate/constraint-ledger";
import { FlowTrace } from "@/components/mandate/flow-trace";
import { OrderSummary } from "@/components/mandate/order-summary";
import { ReceiptPlate } from "@/components/mandate/receipt-plate";
import { Revocation, type Path } from "@/components/mandate/revocation";
import { SectionHead } from "@/components/mandate/section-head";
import { SimulationGate } from "@/components/mandate/simulation-gate";
import { StrategyFields } from "@/components/mandate/strategy-fields";
import { Button } from "@/components/ui/kit";
import { CopyValue } from "@/components/ui/copy-value";
import { Reveal } from "@/components/ui/reveal";
import { Stamp } from "@/components/ui/kit";
import { DEMO, DEMO_STRATEGY_HASH } from "@/lib/demo";

/**
 * Full inspection surface, structured as numbered chapters: the ten-second
 * answer first (authority + summary card), then constraints, settlement,
 * simulation, evidence, and the stop paths. Demo mode: synthetic state,
 * real interactions, honest fail-closed handling for unknown hashes.
 */
export function MandateInspector({ hash, resolved }: { hash: string; resolved: boolean }) {
  const [revoked, setRevoked] = useState(false);

  const revoke = (path: Path) => {
    if (path === "mandate") setRevoked(true);
  };

  if (!resolved) {
    return (
      <div className="mx-auto max-w-[1440px] border-x border-rule px-6 py-24 lg:px-10">
        <h1 className="display text-[clamp(2rem,4vw,3.25rem)]">UNKNOWN: mandate not resolved</h1>
        <p className="lede mt-4 max-w-[60ch]">
          This inspection route only resolves mandates this deployment knows. An unknown strategy hash
          fails closed: no status, no assumptions, no cached green state.
        </p>
        <div className="mono-data mt-6">
          <CopyValue value={hash || "unknown"} />
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
        <ChevronRight size={12} strokeWidth={2.25} aria-hidden="true" />
        <CopyValue value={hash} />
      </nav>

      {/* ------------------------------------------------ hero band */}
      <div className="mt-10 grid items-end gap-12 border-b border-rule pb-14 lg:grid-cols-[1.12fr_0.88fr]">
        <div>
          <div className="mono-data flex flex-wrap items-center gap-3">
            <Stamp kind="EXPIRING" label="SAMPLE: synthetic demo state, not live chain data" />
          </div>
          <h1 className="display mt-5 break-all text-[clamp(2.5rem,5vw,4.25rem)]">{DEMO.agent.ens}</h1>
          <p className="lede mt-5 max-w-[60ch]">
            May convert USDC → WETH through 1inch Aggregation Router v6, capped per call and in total,
            output pushed back to the treasury.
          </p>
          <div className="mono-data mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-ink-2">
            <CopyValue value={DEMO.agent.address} />
            <span className="text-ink-3" aria-hidden="true">·</span>
            <span>Sepolia</span>
            <span className="text-ink-3" aria-hidden="true">·</span>
            <span>
              verified at block{" "}
              <span className="text-ink">{DEMO.identity.verifiedAtBlock.toLocaleString("en-US")}</span>
            </span>
          </div>
        </div>
        <Reveal delay={0.06}>
          <OrderSummary stopped={revoked} />
        </Reveal>
      </div>

      {/* ------------------------------------------------ 01 constraints */}
      <section className="mt-20" aria-label="Constraints">
        <Reveal>
          <SectionHead
            num="01"
            title="Constraints"
            lede="What was approved, what is currently effective, and whether each still holds. The result column is recomputed from the mandate, not cached."
          />
        </Reveal>
        <Reveal delay={0.05}>
          <div className="mt-8">
            <ConstraintLedger stopped={revoked} />
          </div>
        </Reveal>
      </section>

      {/* ------------------------------------------------ 02 settlement */}
      <section className="mt-20" aria-label="Settlement">
        <Reveal>
          <SectionHead
            num="02"
            title="Settlement"
            lede="Where value moves, and where it may never go: physical custody stays with the treasury; only the Aqua allowance lane moves."
          />
        </Reveal>
        <div className="mt-8 grid gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          <Reveal>
            <AquaBalances />
          </Reveal>
          <Reveal delay={0.06}>
            <FlowTrace stopped={revoked} estimate={!revoked} />
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------ 03 simulation */}
      <section id="simulate" className="mt-20" aria-label="Simulation">
        <Reveal>
          <SectionHead
            num="03"
            title="Simulation"
            lede="Advisory by definition: the contract repeats every check at execution, so a pass here never authorizes by itself."
          />
        </Reveal>
        <Reveal delay={0.05}>
          <div className="mt-8">
            <SimulationGate stopped={revoked} />
          </div>
        </Reveal>
      </section>

      {/* ------------------------------------------------ 04 evidence */}
      <section className="mt-20" aria-label="Evidence">
        <Reveal>
          <SectionHead
            num="04"
            title="Evidence"
            lede="The receipt is the only surface allowed to say CONFIRMED, and the exact fields are the machine truth behind every summary."
          />
        </Reveal>
        <div className="mt-8 grid gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <Reveal>
            <div id="fields">
              <ReceiptPlate />
            </div>
          </Reveal>
          <Reveal delay={0.06}>
            <StrategyFields />
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------ 05 stop authority */}
      <section id="revoke" className="mt-20" aria-label="Stop authority">
        <Reveal>
          <SectionHead
            num="05"
            title="Stop authority"
            lede="Three independent kill switches, each confirmed alone. Revoking any of them reverts execution onchain."
            accent={revoked ? "revoked" : undefined}
          />
        </Reveal>
        <Reveal delay={0.05}>
          <div className="mt-8">
            <Revocation revoked={revoked} onRevoke={revoke} />
          </div>
        </Reveal>
      </section>
    </div>
  );
}
