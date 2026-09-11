export type BazanticLaneProof = {
  recipe: {
    id: string;
    handle: string;
    result: "PASS" | "FAIL" | "UNKNOWN";
    payment: null;
    paymentLabel: "Recipe call: unpriced";
    evidence: { provider: string; responseHash: string }[];
  };
  paidIngredients: {
    service: string;
    amountBaseUnits: string;
    amountUsd: string;
    settlementUrl: string;
  }[];
  executionLane: { networkLabel: "Sepolia" };
  routeAssuranceLane: { networkLabel: "Ethereum mainnet"; provesExecutionReceipt: false };
};

export function BazanticLane({ proof }: { proof?: BazanticLaneProof }) {
  if (!proof) {
    return (
      <p role="status" className="mono-data text-unknown">
        UNKNOWN: recorded Bazantic proof is unavailable.
      </p>
    );
  }
  return (
    <div className="overflow-hidden border border-rule bg-ink text-paper">
      <div className="dot-grid relative grid min-h-60 gap-10 p-7 sm:grid-cols-[1fr_auto] sm:items-end lg:p-10">
        <div className="relative z-10 max-w-[48rem]">
          <p className="ledger-label text-paper/55">Ethereum mainnet · recorded route assurance</p>
          <h3 className="display mt-4 text-[clamp(2rem,5vw,4rem)]">
            Agents bought the proof they needed.
          </h3>
          <p className="mt-5 max-w-[62ch] text-sm leading-6 text-paper/65">
            Bazantic’s Recipe calls 1inch <code>getClassicSwapRoute</code>, then Mandate{" "}
            <code>assessOneInchRoute</code>. It proves the mainnet route satisfies policy; it does
            not execute or prove the separate Sepolia mandate transaction.
          </p>
        </div>
        <span className="ledger-label relative z-10 border border-confirmed/50 bg-confirmed/15 px-3 py-2 text-[#80d79f]">
          {proof.recipe.result} · proof recorded
        </span>
      </div>
      <div className="grid border-y border-white/15 sm:grid-cols-3">
        {[
          ["01", "1inch Classic", "paid route intelligence"],
          ["02", "Bazantic recipe", proof.recipe.handle],
          ["03", "Mandate Inspector", "independent verification"],
        ].map(([number, title, detail], index) => (
          <div
            key={title}
            className={`min-h-32 p-5 ${index < 2 ? "border-b border-white/15 sm:border-b-0 sm:border-r" : ""}`}
          >
            <span className="mono-data text-paper/35">{number}</span>
            <strong className="mt-5 block text-sm font-medium">{title}</strong>
            <span className="mono-data mt-1 block text-paper/50">{detail}</span>
          </div>
        ))}
      </div>
      <div className="grid gap-8 bg-raised p-6 text-ink lg:grid-cols-[0.85fr_1.15fr] lg:p-8">
        <dl className="mono-data grid content-start gap-3 text-[0.8125rem]">
          <div className="flex flex-wrap justify-between gap-3 border-b border-rule pb-3">
            <dt className="text-ink-3">Recipe ID</dt>
            <dd>{proof.recipe.id}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-3 border-b border-rule pb-3">
            <dt className="text-ink-3">Network</dt>
            <dd>{proof.routeAssuranceLane.networkLabel}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-3 border-b border-rule pb-3">
            <dt className="text-ink-3">Recipe orchestration</dt>
            <dd>{proof.recipe.paymentLabel}</dd>
          </div>
        </dl>
        <div>
          <p className="ledger-label text-ink-3">Priced x402 ingredients settled on Base</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {proof.paidIngredients.map((ingredient) => (
              <a
                key={ingredient.service}
                href={ingredient.settlementUrl}
                target="_blank"
                rel="noreferrer"
                className="block border border-rule bg-paper p-4 transition-colors hover:border-accent"
              >
                <strong className="block text-[0.9375rem]">{ingredient.service}</strong>
                <span className="mono-data mt-2 block text-ink-2">
                  {ingredient.amountUsd} USDC ({ingredient.amountBaseUnits} base units)
                </span>
                <span className="ledger-label mt-4 block text-accent">Open settlement ↗</span>
              </a>
            ))}
          </div>
          <p className="mt-4 text-sm leading-6 text-ink-2">
            The dashboard Recipe test is intentionally unpriced orchestration. Payment evidence
            comes from calling each priced gateway operation directly with a Bazantic spend grant;
            the settlement links above are those canonical Base receipts.
          </p>
        </div>
        <ul className="mono-data grid gap-2 break-all text-[0.6875rem] text-ink-3 lg:col-span-2">
          {proof.recipe.evidence.map((entry) => (
            <li key={entry.provider}>
              {entry.provider}: {entry.responseHash}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
