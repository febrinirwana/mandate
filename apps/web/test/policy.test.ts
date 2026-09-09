import { describe, expect, it } from "vitest";

import {
  compilePolicy,
  parsePolicyProfile,
  type PolicyDraftV1,
  type PolicyProfileV1,
} from "../src/lib/policy";

const address = (digit: string): `0x${string}` => `0x${digit.repeat(40)}`;
const hash = (digit: string): `0x${string}` => `0x${digit.repeat(64)}`;

const profile: PolicyProfileV1 = {
  agent: { name: "Nova", address: address("2") },
  ens: {
    registry: address("3"),
    resolver: address("4"),
    label: "nova",
    node: hash("5"),
  },
  tokenIn: { symbol: "USDC", address: address("6"), decimals: 6 },
  tokenOut: { symbol: "WETH", address: address("7"), decimals: 18 },
  route: { target: address("8"), selector: "0x12345678" },
};

const draft: PolicyDraftV1 = {
  version: 1,
  agent: "Nova",
  tokenIn: "USDC",
  tokenOut: "WETH",
  maxInput: "1000",
  minRate: "0.001",
  expiresAt: "2030-01-01T00:00:00.000Z",
};

describe("policy compiler", () => {
  it("derives every onchain contract field from the trusted policy profile", () => {
    const strategy = compilePolicy(draft, profile, {
      maker: address("1"),
      validAfter: "1700000000",
      salt: hash("a"),
    });

    expect(strategy).toMatchObject({
      maker: address("1"),
      agent: address("2"),
      ensRegistry: address("3"),
      ensResolver: address("4"),
      ensLabel: "nova",
      ensNode: hash("5"),
      tokenIn: address("6"),
      tokenOut: address("7"),
      swapTarget: address("8"),
      swapSelector: "0x12345678",
      maxInputPerCall: "1000000000",
      maxInputTotal: "1000000000",
      minRateNumerator: "1000000000",
      minRateDenominator: "1",
      validAfter: "1700000000",
      validUntil: "1893456000",
      salt: hash("a"),
    });
  });

  it("accepts a genesis-valid local authority without rounding a timestamp through JavaScript", () => {
    expect(
      compilePolicy(draft, profile, { maker: address("1"), validAfter: "0", salt: hash("a") })
        .validAfter,
    ).toBe("0");
  });

  it("rejects expiry beyond the live app duration limit before a wallet request", () => {
    expect(() =>
      compilePolicy(draft, profile, {
        maker: address("1"),
        validAfter: "0",
        salt: hash("a"),
        maxMandateDuration: "2592000",
      }),
    ).toThrow(/duration/i);
  });

  it("refuses an agent outside the trusted policy profile", () => {
    expect(() =>
      compilePolicy({ ...draft, agent: "Untrusted" }, profile, {
        maker: address("1"),
        validAfter: "1700000000",
        salt: hash("a"),
      }),
    ).toThrow(/agent/i);
  });

  it("refuses an asset pair outside the trusted policy profile", () => {
    expect(() =>
      compilePolicy({ ...draft, tokenIn: "ETH" }, profile, {
        maker: address("1"),
        validAfter: "1700000000",
        salt: hash("a"),
      }),
    ).toThrow();
  });
});

describe("policy profile configuration", () => {
  it("accepts only a complete strict profile", () => {
    expect(parsePolicyProfile(JSON.stringify(profile))).toEqual(profile);
    expect(parsePolicyProfile(JSON.stringify({ ...profile, unsafe: true }))).toBeUndefined();
    expect(
      parsePolicyProfile(
        JSON.stringify({ ...profile, route: { ...profile.route, selector: "0x00" } }),
      ),
    ).toBeUndefined();
  });
});
