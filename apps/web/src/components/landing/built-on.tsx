const PARTNERS = [
  { name: "1inch Aqua", role: "Settlement engine — wallet-custodied pull and push" },
  { name: "ENSv2", role: "Identity layer — live, revocable agent names" },
  { name: "Bazantic", role: "Paid machine-readable receipt audits" },
  { name: "Foundry", role: "Adversarial proofs before any pixels" },
] as const;

export function BuiltOn() {
  return (
    <section className="border-b border-rule" aria-label="Built on">
      <div className="mx-auto max-w-[1440px] border-x border-rule px-6 py-16 lg:px-10">
        <div className="grid gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
          {PARTNERS.map((p) => (
            <div key={p.name} className="border-l border-rule pl-5 first:border-l-0 first:pl-0 lg:pl-6">
              <div className="text-[1.125rem] font-medium tracking-[-0.01em]">{p.name}</div>
              <div className="mono-data mt-1.5 max-w-[30ch] text-ink-2">{p.role}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
