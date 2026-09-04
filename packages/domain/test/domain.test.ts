import { describe, expect, it } from "vitest";
import sepoliaManifest from "../../contracts/src/deployments/sepolia.json" with { type: "json" };

import {
  AddressSchema,
  DecimalStringSchema,
  DeploymentManifestV1Schema,
  Hash32Schema,
  ReasonCodeSchema,
  ReceiptAuditV1Schema,
  StrategyV1Schema,
  jsonSchemas,
} from "../src/index.js";

const address = (digit: string) => `0x${digit.repeat(40)}`;
const hash = (digit: string) => `0x${digit.repeat(64)}`;

const validStrategy = {
  version: 1,
  maker: address("1"),
  agent: address("2"),
  ensRegistry: address("3"),
  ensResolver: address("4"),
  ensLabel: "operator",
  ensNode: hash("5"),
  tokenIn: address("6"),
  tokenOut: address("7"),
  swapTarget: address("8"),
  swapSelector: "0x12345678",
  minRateNumerator: "1",
  minRateDenominator: "2",
  maxInputPerCall: "500000000",
  maxInputTotal: "2000000000",
  validAfter: "1788540000",
  validUntil: "1788626400",
  salt: hash("9"),
} as const;

const validManifest = {
  version: 1,
  environment: "SEPOLIA",
  chainId: "11155111",
  generatedAt: "2026-09-04T17:19:22.913Z",
  contracts: [
    {
      kind: "AQUA",
      name: "Aqua",
      enabled: true,
      external: true,
      official: true,
      chainId: "11155111",
      address: "0x1111113ccf1426a8e30e2bff5e005d929bf6a90a",
      codeHash: "0x720bc02d220db318164dc3bade86eec1f3655bdc00fc1174de7d816a95c341f8",
      sourceRevision: "81c26e4619ce21556ab02b3284ee2685de21fb18",
      sourceUrl: "https://github.com/1inch/aqua/tree/v1.0.0",
      verificationBlock: {
        number: "11634851",
        hash: "0x518864a71a48395ad79caad0fd1147f0e396cf2aad9ca38842e50266d366d61d",
      },
      verifiedAt: "2026-09-04T17:19:22.913Z",
      probes: [
        {
          method: "rawBalances(address,address,bytes32,address,address)",
          resultHash: hash("a"),
        },
      ],
    },
  ],
  tokens: [],
} as const;

describe("primitive boundary schemas", () => {
  it("rejects numbers, floating strings, malformed addresses, and malformed hashes", () => {
    expect(DecimalStringSchema.safeParse(1.5).success).toBe(false);
    expect(DecimalStringSchema.safeParse("1.5").success).toBe(false);
    expect(DecimalStringSchema.safeParse("01").success).toBe(false);
    expect(AddressSchema.safeParse("0x1234").success).toBe(false);
    expect(Hash32Schema.safeParse(`0x${"a".repeat(63)}`).success).toBe(false);
  });
});

describe("StrategyV1Schema", () => {
  it("round-trips exact decimal strings through JSON", () => {
    const parsed = StrategyV1Schema.parse(validStrategy);
    const roundTrip = StrategyV1Schema.parse(JSON.parse(JSON.stringify(parsed)));

    expect(roundTrip).toEqual(validStrategy);
    expect(roundTrip.maxInputTotal).toBe("2000000000");
  });

  it("accepts the full bytes32 salt domain, including zero", () => {
    expect(StrategyV1Schema.safeParse({ ...validStrategy, salt: hash("0") }).success).toBe(true);
  });

  it("rejects unknown fields and invalid policy invariants", () => {
    expect(StrategyV1Schema.safeParse({ ...validStrategy, surprise: true }).success).toBe(false);
    expect(StrategyV1Schema.safeParse({ ...validStrategy, minRateDenominator: "0" }).success).toBe(
      false,
    );
    expect(
      StrategyV1Schema.safeParse({
        ...validStrategy,
        maxInputPerCall: "2000000001",
      }).success,
    ).toBe(false);
    expect(
      StrategyV1Schema.safeParse({ ...validStrategy, validUntil: validStrategy.validAfter })
        .success,
    ).toBe(false);
    expect(
      StrategyV1Schema.safeParse({
        ...validStrategy,
        maxInputTotal:
          "115792089237316195423570985008687907853269984665640564039457584007913129639936",
      }).success,
    ).toBe(false);
  });
});

describe("stable reason codes", () => {
  it("accepts a PRD code and rejects unknown codes", () => {
    expect(ReasonCodeSchema.parse("MANDATE_REVOKED")).toBe("MANDATE_REVOKED");
    expect(ReasonCodeSchema.safeParse("NEW_UNDOCUMENTED_CODE").success).toBe(false);
    expect(ReasonCodeSchema.options).toHaveLength(27);
    expect(ReasonCodeSchema.options.at(-1)).toBe("RECEIPT_NOT_CANONICAL");
  });
});

describe("ReceiptAuditV1Schema", () => {
  it("accepts the stable PRD receipt shape without hidden required fields", () => {
    expect(
      ReceiptAuditV1Schema.parse({
        version: 1,
        result: "COMPLIANT",
        chainId: "11155111",
        txHash: hash("1"),
        block: { number: "11634851", hash: hash("2") },
        strategyHash: hash("3"),
        checks: [],
        evidence: [
          { provider: "1inch", responseHash: hash("4") },
          { provider: "mandate", responseHash: hash("5") },
        ],
      }),
    ).toBeDefined();
  });
});

describe("DeploymentManifestV1Schema", () => {
  it("round-trips complete deployment evidence", () => {
    const parsed = DeploymentManifestV1Schema.parse(validManifest);
    const roundTrip = DeploymentManifestV1Schema.parse(JSON.parse(JSON.stringify(parsed)));

    expect(roundTrip).toEqual(validManifest);
    expect(roundTrip.contracts[0]?.verificationBlock.number).toBe("11634851");
  });

  it("rejects incomplete or cross-chain deployment evidence", () => {
    const incompleteContract: Record<string, unknown> = { ...validManifest.contracts[0] };
    delete incompleteContract["codeHash"];
    expect(
      DeploymentManifestV1Schema.safeParse({
        ...validManifest,
        contracts: [incompleteContract],
      }).success,
    ).toBe(false);
    expect(
      DeploymentManifestV1Schema.safeParse({
        ...validManifest,
        contracts: [{ ...validManifest.contracts[0], chainId: "1" }],
      }).success,
    ).toBe(false);
  });

  it("admits the checked-in Sepolia deployment evidence", () => {
    expect(DeploymentManifestV1Schema.parse(sepoliaManifest).contracts).toHaveLength(3);
  });

  it("exports generated JSON Schema inputs", () => {
    expect(jsonSchemas.strategyV1).toMatchObject({ type: "object" });
    expect(jsonSchemas.deploymentManifestV1).toMatchObject({ type: "object" });
  });
});
