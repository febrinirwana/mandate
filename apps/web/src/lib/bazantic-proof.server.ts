import "server-only";

import rawProof from "../../../../integrations/bazantic/paid-proof.json";

export type BazanticProofView = {
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

function object(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function evidence(value: unknown): { provider: string; responseHash: string }[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const projected = value.map((item) => {
    const entry = object(item);
    const provider = text(entry?.provider);
    const responseHash = text(entry?.responseHash);
    return provider && responseHash && /^0x[0-9a-fA-F]{64}$/.test(responseHash)
      ? { provider, responseHash }
      : undefined;
  });
  return projected.every((entry) => entry)
    ? (projected as { provider: string; responseHash: string }[])
    : undefined;
}

function paidIngredient(value: unknown, service: string) {
  const item = object(value);
  const amountBaseUnits = text(item?.amountBaseUnits);
  const amountUsd = text(item?.amountUsd);
  const settlementTx = text(item?.settlementTx);
  return amountBaseUnits && amountUsd && settlementTx && /^0x[0-9a-fA-F]{64}$/.test(settlementTx)
    ? {
        service,
        amountBaseUnits,
        amountUsd,
        settlementUrl: `https://basescan.org/tx/${settlementTx}`,
      }
    : undefined;
}

export function projectBazanticProof(value: unknown): BazanticProofView | undefined {
  const proof = object(value);
  const recipe = object(proof?.recipe);
  const replay = object(proof?.paidIngredientReplay);
  const id = text(recipe?.id);
  const handle = text(recipe?.handle);
  const result = recipe?.result;
  const recipeEvidence = evidence(recipe?.evidence);
  const oneInch = paidIngredient(replay?.oneInch, "1inch Classic");
  const mandate = paidIngredient(replay?.mandate, "Mandate Inspector");
  if (
    proof?.version !== 1 ||
    !id ||
    !handle ||
    recipe?.payment !== null ||
    (result !== "PASS" && result !== "FAIL" && result !== "UNKNOWN") ||
    !recipeEvidence ||
    !oneInch ||
    !mandate
  )
    return undefined;

  return {
    recipe: {
      id,
      handle,
      result,
      payment: null,
      paymentLabel: "Recipe call: unpriced",
      evidence: recipeEvidence,
    },
    paidIngredients: [oneInch, mandate],
    executionLane: { networkLabel: "Sepolia" },
    routeAssuranceLane: { networkLabel: "Ethereum mainnet", provesExecutionReceipt: false },
  };
}

const checkedInProof = projectBazanticProof(rawProof);
if (!checkedInProof) throw new Error("The checked-in Bazantic proof is malformed.");

export function loadBazanticProof(): BazanticProofView {
  if (!checkedInProof) throw new Error("The checked-in Bazantic proof is malformed.");
  return checkedInProof;
}
