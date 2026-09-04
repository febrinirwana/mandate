"use client";

import { Tip } from "@/components/ui/tooltip";

const PARTNERS = [
  { name: "1INCH AQUA", role: "Settlement engine: wallet-custodied pull and push" },
  { name: "ENSV2", role: "Identity layer: live, revocable agent names" },
  { name: "BAZANTIC", role: "Paid machine-readable receipt audits" },
  { name: "FOUNDRY", role: "Adversarial proofs before any pixels" },
  { name: "VIEM", role: "Typed onchain reads behind every state surface" },
  { name: "WAGMI", role: "Wallet connection for owner and agent" },
] as const;

export function BuiltOn() {
  const strip = (hidden: boolean) => (
    <div className="flex w-max items-center" aria-hidden={hidden || undefined}>
      {PARTNERS.map((p) => (
        <Tip key={p.name} content={p.role}>
          <span className="flex cursor-default items-center gap-10 px-10 py-7" tabIndex={hidden ? -1 : undefined}>
            <span className="h-1.5 w-1.5 rotate-45 bg-ink/30" aria-hidden="true" />
            <span className="whitespace-nowrap text-[1.0625rem] font-medium tracking-[0.02em] text-ink-2 transition-colors hover:text-ink">
              {p.name}
            </span>
          </span>
        </Tip>
      ))}
    </div>
  );

  return (
    <section className="border-b border-rule" aria-label="Built on">
      <div className="mx-auto max-w-[1440px] overflow-hidden border-x border-rule">
        <div className="marquee-track flex w-max animate-marquee">
          {strip(false)}
          {strip(true)}
        </div>
      </div>
    </section>
  );
}
