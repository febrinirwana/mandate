import { afterEach, describe, expect, it } from "vitest";

import { runtimeConfig } from "../src/lib/runtime.server";

const configured = [
  "MANDATE_CHAIN_ID",
  "SEPOLIA_MANDATE_APP",
  "MANDATE_POLICY_PROFILE",
  "MANDATE_SEPOLIA_FAUCET_AMOUNT",
  "NEXT_PUBLIC_PRIVY_APP_ID",
  "MANDATE_LOCAL_RPC_URL",
  "MANDATE_LOCAL_POLICY_PROFILE",
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

function configure(chainId = "11155111") {
  process.env.MANDATE_CHAIN_ID = chainId;
  process.env.SEPOLIA_MANDATE_APP = address("1");
  process.env.MANDATE_POLICY_PROFILE = profile;
  process.env.MANDATE_SEPOLIA_FAUCET_AMOUNT = "100";
}

describe("web runtime", () => {
  it("enables demo funding only for a valid Sepolia profile", () => {
    configure();
    expect(runtimeConfig()?.demoFaucetAmount).toBe("100");

    configure("31337");
    expect(runtimeConfig()?.demoFaucetAmount).toBeUndefined();
  });
  it("ignores a stale local profile when local RPC mode is inactive", () => {
    configure();
    delete process.env.MANDATE_LOCAL_RPC_URL;
    process.env.MANDATE_LOCAL_POLICY_PROFILE = "stale-local-profile";

    expect(runtimeConfig()?.policyProfile?.agent.name).toBe("Nova");
  });

  it("rejects a malformed faucet amount", () => {
    configure();
    process.env.MANDATE_SEPOLIA_FAUCET_AMOUNT = "free";
    expect(runtimeConfig()?.demoFaucetAmount).toBeUndefined();
  });

  it("reports whether Privy is configured without exposing its secret", () => {
    configure();
    delete process.env.NEXT_PUBLIC_PRIVY_APP_ID;
    expect(runtimeConfig()?.privyEnabled).toBe(false);
    process.env.NEXT_PUBLIC_PRIVY_APP_ID = "public-app-id";
    expect(runtimeConfig()?.privyEnabled).toBe(true);
  });
});
