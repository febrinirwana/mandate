import { afterEach, describe, expect, it } from "vitest";

import { GET } from "../src/app/api/demo-funding/route";

const configured = [
  "MANDATE_CHAIN_ID",
  "SEPOLIA_MANDATE_APP",
  "MANDATE_POLICY_PROFILE",
  "MANDATE_SEPOLIA_FAUCET_AMOUNT",
] as const;
const saved = Object.fromEntries(configured.map((key) => [key, process.env[key]]));
const address = (digit: string): `0x${string}` => `0x${digit.repeat(40)}`;
const profile = JSON.stringify({
  agent: { name: "Nova", address: address("2") },
  ens: {
    registry: address("3"),
    resolver: address("4"),
    label: "nova",
    node: `0x${"5".repeat(64)}`,
  },
  tokenIn: { symbol: "MockUSDC", address: address("6"), decimals: 6 },
  tokenOut: { symbol: "MockDAI", address: address("7"), decimals: 18 },
  route: { target: address("8"), selector: "0x12345678" },
});

afterEach(() => {
  for (const key of configured) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("demo funding route", () => {
  it("rejects malformed smart-wallet addresses", async () => {
    process.env.MANDATE_CHAIN_ID = "11155111";
    process.env.SEPOLIA_MANDATE_APP = address("1");
    process.env.MANDATE_POLICY_PROFILE = profile;
    process.env.MANDATE_SEPOLIA_FAUCET_AMOUNT = "100";

    const response = await GET(
      new Request("http://localhost/api/demo-funding?account=not-an-address"),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ kind: "UNAVAILABLE" });
  });

  it("fails closed when the Sepolia faucet is not configured", async () => {
    process.env.MANDATE_CHAIN_ID = "11155111";
    process.env.SEPOLIA_MANDATE_APP = address("1");
    process.env.MANDATE_POLICY_PROFILE = profile;
    delete process.env.MANDATE_SEPOLIA_FAUCET_AMOUNT;

    const response = await GET(
      new Request(`http://localhost/api/demo-funding?account=${address("9")}`),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ kind: "UNAVAILABLE" });
  });
});
