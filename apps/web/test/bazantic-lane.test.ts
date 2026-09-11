import { describe, expect, it } from "vitest";

import { loadBazanticProof, projectBazanticProof } from "../src/lib/bazantic-proof.server";

const oneInchSettlement = "0x19faef678b5585b9f9a0852e4c3be528d9d94408174a8e4681bc02f3e00f8c6a";
const mandateSettlement = "0x7897578d829caa367a8fd368d30ad0d712d17d063cdc9c4c6c9c9202c1ee3938";

describe("Bazantic public proof lane", () => {
  it("projects the checked-in proof without private payer or grant material", () => {
    const proof = loadBazanticProof();

    expect(proof).toMatchObject({
      recipe: {
        id: "05132729-6750-4183-b8fa-4f70b5061b21",
        handle: "mandate-1inch-route-assurance",
        result: "PASS",
        payment: null,
        evidence: [
          {
            provider: "1inch-classic-swap-v6.1",
            responseHash: "0xf9ec9f2bceaac5682c6a4a42efa79fcd607b212d62aef7d6490d13f75124c769",
          },
          {
            provider: "mandate-strategy",
            responseHash: "0x083eeb4cc34e1bfb06191876baf16920e56eed60c6163019fffc7db358a719e1",
          },
        ],
      },
    });
    expect(JSON.stringify(proof)).not.toContain("0x6835A6c084c011452Eeecf130745114CE0783A19");
    expect(JSON.stringify(proof)).not.toContain("c58a779a-393d-475f-b63d-405fff8566e6");
    expect(JSON.stringify(proof)).not.toContain("grantCapUsd");
  });

  it("keeps Sepolia execution and Ethereum-mainnet route assurance visibly separate", () => {
    const proof = loadBazanticProof();

    expect(proof.executionLane.networkLabel).toBe("Sepolia");
    expect(proof.routeAssuranceLane.networkLabel).toBe("Ethereum mainnet");
    expect(proof.routeAssuranceLane.provesExecutionReceipt).toBe(false);
  });

  it("exposes both paid Base ingredient settlements while keeping the unpriced Recipe call distinct", () => {
    const proof = loadBazanticProof();

    expect(proof.recipe.payment).toBeNull();
    expect(proof.recipe.paymentLabel).toBe("Recipe call: unpriced");
    expect(proof.paidIngredients).toEqual([
      {
        service: "1inch Classic",
        amountBaseUnits: "10",
        amountUsd: "0.00001",
        settlementUrl: `https://basescan.org/tx/${oneInchSettlement}`,
      },
      {
        service: "Mandate Inspector",
        amountBaseUnits: "10",
        amountUsd: "0.00001",
        settlementUrl: `https://basescan.org/tx/${mandateSettlement}`,
      },
    ]);
  });

  it("fails closed instead of projecting a malformed public proof", () => {
    expect(projectBazanticProof({ version: 1, recipe: { payment: null } })).toBeUndefined();
  });
});
