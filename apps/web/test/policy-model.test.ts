import { describe, expect, it, vi } from "vitest";

import { createPolicyProposal, type PolicyModelConfig } from "../src/lib/policy-model";

const configuration: PolicyModelConfig = {
  endpoint: "https://model.example/v1/chat/completions",
  apiKey: "test-key",
  model: "structured-model",
};

const validProposal = {
  version: 1,
  intent: "Let Nova swap 100 USDC for WETH until 2030.",
  agent: "Nova",
  tokenIn: "USDC",
  tokenOut: "WETH",
  maxInput: "100",
  minRate: "0.001",
  expiresAt: "2030-01-01T00:00:00.000Z",
};

describe("policy model boundary", () => {
  it("reports unavailable without complete server configuration", async () => {
    const fetcher = vi.fn();

    await expect(createPolicyProposal(validProposal.intent, undefined, fetcher)).resolves.toEqual({ kind: "UNAVAILABLE" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("returns only a strict structured policy proposal", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify(validProposal) } }],
    })));

    await expect(createPolicyProposal(validProposal.intent, configuration, fetcher)).resolves.toEqual({
      kind: "PROPOSAL",
      proposal: validProposal,
    });

    expect(fetcher).toHaveBeenCalledWith(
      configuration.endpoint,
      expect.objectContaining({ method: "POST", headers: expect.objectContaining({ authorization: "Bearer test-key" }) }),
    );
  });

  it("turns malformed provider output into a clarification instead of a strategy", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ ...validProposal, swapTarget: "0xunsafe" }) } }],
    })));

    await expect(createPolicyProposal(validProposal.intent, configuration, fetcher)).resolves.toEqual({
      kind: "CLARIFICATION",
      message: expect.any(String),
    });
  });
});
