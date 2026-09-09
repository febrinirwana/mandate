import { afterEach, describe, expect, it } from "vitest";

import { GET } from "../src/app/api/policy-readiness/route";

const configured = ["SEPOLIA_MANDATE_APP", "MANDATE_POLICY_PROFILE", "SEPOLIA_RPC_URL"] as const;
const saved = Object.fromEntries(configured.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of configured) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("policy readiness route", () => {
  it("fails closed when no trusted profile is configured", async () => {
    process.env.SEPOLIA_MANDATE_APP = "0x1111111111111111111111111111111111111111";
    delete process.env.MANDATE_POLICY_PROFILE;

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ kind: "UNAVAILABLE" });
  });
});
