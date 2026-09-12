import { describe, expect, it } from "vitest";
import { PRIVY_CONFIG } from "../src/components/providers";

import type { PolicyDraftV1, PolicyProfileV1 } from "../src/lib/policy";
import {
  authorizationChecklist,
  createIssuanceDefaults,
  deriveAccountPreparationState,
  issuedMandateUrl,
  reviewPolicyDraft,
} from "../src/lib/issuance";
const address = (digit: string): `0x${string}` => `0x${digit.repeat(40)}`;
const hash = (digit: string): `0x${string}` => `0x${digit.repeat(64)}`;

const profile: PolicyProfileV1 = {
  agent: { name: "Nova", address: address("2") },
  ens: { registry: address("3"), resolver: address("4"), label: "nova", node: hash("5") },
  tokenIn: { symbol: "USDC", address: address("6"), decimals: 6 },
  tokenOut: { symbol: "DAI", address: address("7"), decimals: 18 },
  route: { target: address("8"), selector: "0x12345678" },
};

const draft: PolicyDraftV1 = {
  version: 1,
  agent: "Nova",
  tokenIn: "USDC",
  tokenOut: "DAI",
  maxInput: "1",
  minRate: "1",
  expiresAt: "2026-01-02T00:00:00.000Z",
};

const compilationContext = {
  maker: address("1"),
  validAfter: "1767225600",
  maxMandateDuration: "86400",
  salt: hash("9"),
};

describe("issuance state", () => {
  it("creates deterministic 1-USDC, rate-1, 24-hour defaults", () => {
    expect(createIssuanceDefaults(new Date("2026-01-01T00:00:00.000Z"), 0)).toEqual({
      maxInput: "1",
      minRate: "1",
      expiresAt: "2026-01-02T00:00",
    });
  });

  it("reports every invalid economic field without discarding the entered values", () => {
    const entered = {
      ...draft,
      maxInput: "0",
      minRate: "not-a-rate",
      expiresAt: "2026-01-01T00:00:00.000Z",
    };

    expect(reviewPolicyDraft(entered, profile, compilationContext)).toEqual({
      draft: entered,
      strategy: undefined,
      issues: {
        maxInput: "maximum spend must be positive",
        minRate: "rate must be a positive decimal",
        expiresAt: "expiry must follow valid-after",
      },
    });
  });

  it("identifies an expiry that exceeds the live contract duration limit", () => {
    expect(
      reviewPolicyDraft(
        { ...draft, expiresAt: "2026-01-02T00:00:01.000Z" },
        profile,
        compilationContext,
      ),
    ).toMatchObject({
      strategy: undefined,
      issues: { expiresAt: "expiry exceeds the Mandate duration limit" },
    });
  });

  it("returns an exact strategy only when every economic field is valid", () => {
    expect(reviewPolicyDraft(draft, profile, compilationContext)).toMatchObject({
      draft,
      issues: {},
      strategy: {
        maxInputPerCall: "1000000",
        maxInputTotal: "1000000",
        minRateNumerator: "1000000000000",
        minRateDenominator: "1",
        validUntil: "1767312000",
      },
    });
  });

  it("derives authorization exclusively from the visible checklist", () => {
    const checklist = authorizationChecklist({
      smartAccountReady: false,
      chainReady: true,
      ensReady: true,
      fundingReady: false,
      economicFieldsValid: true,
      batchReady: true,
    });

    expect(checklist.canAuthorize).toBe(checklist.items.every((item) => item.complete));
    expect(checklist.items.filter((item) => !item.complete)).toEqual([
      {
        id: "smartAccount",
        complete: false,
        reason: "Prepare the dedicated owner smart account.",
      },
      {
        id: "funding",
        complete: false,
        reason: "Fund the demo account or lower the maximum spend.",
      },
    ]);
  });

  it("moves account preparation through finite recovery states", () => {
    expect(
      deriveAccountPreparationState({
        authenticated: false,
        privyReady: false,
        smartAccount: undefined,
        attemptStartedAt: undefined,
        now: 0,
        timeoutMs: 30_000,
      }),
    ).toEqual({ kind: "SIGNED_OUT" });

    expect(
      deriveAccountPreparationState({
        authenticated: true,
        privyReady: false,
        smartAccount: undefined,
        attemptStartedAt: undefined,
        now: 0,
        timeoutMs: 30_000,
      }),
    ).toEqual({ kind: "AUTHENTICATING" });

    expect(
      deriveAccountPreparationState({
        authenticated: true,
        privyReady: true,
        smartAccount: address("1"),
        attemptStartedAt: undefined,
        now: 0,
        timeoutMs: 30_000,
      }),
    ).toEqual({ kind: "READY" });

    expect(
      deriveAccountPreparationState({
        authenticated: true,
        privyReady: true,
        smartAccount: undefined,
        attemptStartedAt: 0,
        now: 29_999,
        timeoutMs: 30_000,
      }),
    ).toEqual({ kind: "PREPARING_ACCOUNT" });

    expect(
      deriveAccountPreparationState({
        authenticated: true,
        privyReady: true,
        smartAccount: undefined,
        attemptStartedAt: 0,
        now: 30_000,
        timeoutMs: 30_000,
      }),
    ).toEqual({ kind: "RECOVERABLE_ERROR", actions: ["RETRY", "SIGN_OUT"] });

    expect(
      deriveAccountPreparationState({
        authenticated: true,
        privyReady: true,
        smartAccount: undefined,
        attemptStartedAt: 30_000,
        now: 30_000,
        timeoutMs: 30_000,
      }),
    ).toEqual({ kind: "PREPARING_ACCOUNT" });
  });

  it("configures a dedicated embedded smart wallet for every Privy login method", () => {
    expect(PRIVY_CONFIG.embeddedWallets?.ethereum?.createOnLogin).toBe("all-users");
  });

  it("opens the inspector immediately with the submitted activation transaction", () => {
    expect(issuedMandateUrl(hash("a"), hash("b"))).toBe(
      `/mandates/${hash("a")}?justIssued=1&activationTx=${hash("b")}`,
    );
  });
});
