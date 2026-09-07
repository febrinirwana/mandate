import { describe, expect, it } from "vitest";
import sepoliaManifest from "../../contracts/src/deployments/sepolia.json" with { type: "json" };

import {
  AddressSchema,
  DecimalStringSchema,
  DeploymentManifestV1Schema,
  VenueManifestV1Schema,
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

const validVenueManifest = {
  version: 1,
  environment: "ETHEREUM_MAINNET_FORK",
  chainId: "1",
  generatedAt: "2026-09-07T05:00:00.000Z",
  verificationBlock: { number: "24000000", hash: hash("1") },
  contracts: [
    {
      kind: "SWAP_TARGET",
      name: "1inch Aggregation Router V6",
      enabled: true,
      external: true,
      official: true,
      chainId: "1",
      address: address("1"),
      codeHash: hash("2"),
      sourceRevision: "a".repeat(40),
      sourceUrl: "https://etherscan.io/address/0x111111125421ca6dc452d289314280a0f8842a65#code",
      verificationBlock: { number: "24000000", hash: hash("1") },
      verifiedAt: "2026-09-07T05:00:00.000Z",
      probes: [{ method: "eth_getCode", resultHash: hash("3") }],
    },
    {
      kind: "AQUA",
      name: "1inch Aqua",
      enabled: true,
      external: true,
      official: true,
      chainId: "1",
      address: address("6"),
      codeHash: hash("8"),
      sourceRevision: "b".repeat(40),
      sourceUrl:
        "https://business.1inch.com/portal/documentation/aqua/reference/contract-addresses",
      verificationBlock: { number: "24000000", hash: hash("1") },
      verifiedAt: "2026-09-07T05:00:00.000Z",
      probes: [{ method: "eth_getCode", resultHash: hash("9") }],
    },
    {
      kind: "SWAP_EXECUTOR",
      name: "1inch Aggregation Executor",
      enabled: true,
      external: true,
      official: true,
      chainId: "1",
      address: address("5"),
      codeHash: hash("a"),
      sourceRevision: "etherscan-verified:AggregationExecutor",
      sourceUrl: "https://etherscan.io/",
      verificationBlock: { number: "24000000", hash: hash("1") },
      verifiedAt: "2026-09-07T05:00:00.000Z",
      probes: [{ method: "eth_getCode", resultHash: hash("b") }],
    },
  ],
  tokens: [
    { chainId: "1", address: address("2"), codeHash: hash("4"), decimals: 18, symbol: "WETH" },
    { chainId: "1", address: address("3"), codeHash: hash("5"), decimals: 6, symbol: "USDC" },
  ],
  route: {
    provider: "1inch-classic-swap-v6.1",
    chainId: "1",
    apiVersion: "v6.1",
    endpoint: "https://api.1inch.com/swap/v6.1/1/swap",
    requestId: "request-123",
    requestedAt: "2026-09-07T05:00:00.000Z",
    responseHash: hash("6"),
    target: address("1"),
    selector: "0x07ed2379",
    calldataSchema: "swap(address,(address,address,address,address,uint256,uint256,uint256),bytes)",
    calldata: "0x07ed2379abcd",
    calldataHash: hash("7"),
    caller: address("4"),
    executor: address("5"),
    recipient: address("4"),
    tokenIn: address("2"),
    tokenOut: address("3"),
    amountIn: "100000000000000000",
    quotedAmountOut: "250000000",
    routeMinimumOut: "240000000",
    nativeValue: "0",
    allowPartialFill: false,
    deadline: null,
    protocols: ["UNISWAP_V3"],
  },
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
    expect(ReasonCodeSchema.parse("INPUT_TRANSFER_MISMATCH")).toBe("INPUT_TRANSFER_MISMATCH");
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

describe("VenueManifestV1Schema", () => {
  it("round-trips an exact-input route bound to one canonical mainnet block", () => {
    expect(VenueManifestV1Schema.parse(validVenueManifest)).toEqual(validVenueManifest);
  });

  it.each([
    ["native value", { route: { ...validVenueManifest.route, nativeValue: "1" } }],
    ["partial fill", { route: { ...validVenueManifest.route, allowPartialFill: true } }],
    ["different recipient", { route: { ...validVenueManifest.route, recipient: address("5") } }],
    ["different chain", { chainId: "11155111" }],
    ["unknown target", { route: { ...validVenueManifest.route, target: address("9") } }],
    ["unknown executor", { route: { ...validVenueManifest.route, executor: address("9") } }],
  ])("rejects a venue manifest with %s", (_name, mutation) => {
    expect(VenueManifestV1Schema.safeParse({ ...validVenueManifest, ...mutation }).success).toBe(
      false,
    );
  });

  it("exports the venue manifest JSON Schema", () => {
    expect(jsonSchemas.venueManifestV1).toMatchObject({ type: "object" });
  });
});
