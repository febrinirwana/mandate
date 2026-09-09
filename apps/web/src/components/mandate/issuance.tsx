"use client";

import { AuthorityComposer } from "@/components/mandate/authority-composer";
import type { MandateRuntime } from "@/lib/runtime.server";

export function Issuance({ runtime }: { runtime: MandateRuntime | null }) {
  if (!runtime) {
    return (
      <section className="mx-auto max-w-[1440px] border-x border-rule px-6 py-24 lg:px-10">
        <p className="ledger-label text-ink-3">Runtime unavailable</p>
        <h1 className="display mt-4 text-[clamp(2rem,4vw,3.25rem)]">
          Mandate needs its Sepolia configuration.
        </h1>
        <p className="lede mt-4 max-w-[56ch]">
          Set MANDATE_CHAIN_ID and SEPOLIA_MANDATE_APP in apps/web/.env.local, then restart the web
          server. Wallet setup never bypasses chain configuration.
        </p>
      </section>
    );
  }

  return <AuthorityComposer runtime={runtime} />;
}
