import { afterEach, describe, expect, it } from "vitest";

import { POST } from "../src/app/api/policy-proposals/route";

const modelEnvironment = ["POLICY_AI_ENDPOINT", "POLICY_AI_API_KEY", "POLICY_AI_MODEL"] as const;
const saved = Object.fromEntries(modelEnvironment.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of modelEnvironment) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("policy proposal route", () => {
  it("fails closed when model configuration is unavailable", async () => {
    for (const key of modelEnvironment) delete process.env[key];

    const response = await POST(new Request("http://mandate.test/api/policy-proposals", {
      method: "POST",
      body: JSON.stringify({ intent: "Let Nova swap 100 USDC for WETH until 2030." }),
    }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ kind: "UNAVAILABLE" });
  });

  it("rejects an invalid request before it reaches the model", async () => {
    const response = await POST(new Request("http://mandate.test/api/policy-proposals", {
      method: "POST",
      body: JSON.stringify({ intent: "" }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ kind: "CLARIFICATION", message: expect.any(String) });
  });
});
