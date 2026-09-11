import { describe, expect, it } from "vitest";
import sepoliaManifest from "../../contracts/src/deployments/sepolia.json" with { type: "json" };

import {
  AddressSchema,
  CanonicalReceiptEvidenceV1Schema,
  DecimalStringSchema,
  DemoExecutionRequestV1Schema,
  DemoExecutionResultV1Schema,
  DeploymentManifestV1Schema,
  Hash32Schema,
  MandateSnapshotV1Schema,
  parsePolicyProfileJson,
  PolicyProfileV1Schema,
  ReasonCodeSchema,
  ReceiptAuditV1Schema,
  RouteAssessmentRequestV1Schema,
  RouteAssessmentV1Schema,
  StrategyV1Schema,
  VenueManifestV1Schema,
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

describe("RouteAssessment schemas", () => {
  const request = {
    version: 1,
    chainId: "1",
    mandateApp: address("a"),
    strategy: {
      ...validStrategy,
      swapTarget: "0x111111125421ca6dc452d289314280a0f8842a65",
      swapSelector: "0x07ed2379",
    },
    amountIn: "100000000000000000",
    agentMinOut: "240000000",
    executionDeadline: "1788540300",
    protocols: ["UNISWAP_V3"],
    provider: {
      status: "AVAILABLE",
      requestId: "request-123",
      requestedAt: "2026-09-10T01:00:00.000Z",
      response: {
        dstAmount: "250000000",
        tx: {
          from: address("a"),
          to: "0x111111125421ca6dc452d289314280a0f8842a65",
          data: "0x07ed2379abcd",
          value: "0",
        },
      },
    },
  } as const;

  const assessment = {
    version: 1,
    result: "PASS",
    reasons: [],
    chainId: "1",
    strategyHash: hash("1"),
    assessedAt: "2026-09-10T01:00:01.000Z",
    request: {
      mandateApp: address("a"),
      amountIn: "100000000000000000",
      agentMinOut: "240000000",
      executionDeadline: "1788540300",
    },
    route: {
      provider: "1inch-classic-swap-v6.1",
      requestId: "request-123",
      target: "0x111111125421ca6dc452d289314280a0f8842a65",
      selector: "0x07ed2379",
      executor: address("b"),
      caller: address("a"),
      recipient: address("a"),
      tokenIn: address("6"),
      tokenOut: address("7"),
      amountIn: "100000000000000000",
      quotedAmountOut: "250000000",
      routeMinimumOut: "240000000",
      nativeValue: "0",
      allowPartialFill: false,
      protocols: ["UNISWAP_V3"],
    },
    checks: [{ code: "ROUTE_BINDINGS", result: "PASS" }],
    evidence: [
      { provider: "1inch-classic-swap-v6.1", responseHash: hash("2") },
      { provider: "mandate-strategy", responseHash: hash("1") },
    ],
  } as const;

  it("round-trips strict provider input and fail-closed assessment output", () => {
    expect(RouteAssessmentRequestV1Schema.parse(request)).toEqual(request);
    expect(RouteAssessmentV1Schema.parse(assessment)).toEqual(assessment);
    expect(
      RouteAssessmentRequestV1Schema.safeParse({ ...request, amountIn: 100000000000000000n })
        .success,
    ).toBe(false);
    expect(
      RouteAssessmentRequestV1Schema.safeParse({ ...request, chainId: "11155111" }).success,
    ).toBe(false);
    expect(
      RouteAssessmentRequestV1Schema.safeParse({
        ...request,
        provider: { ...request.provider, authorization: "Bearer secret" },
      }).success,
    ).toBe(false);
  });

  it("rejects a positive result when any required check is not PASS", () => {
    expect(
      RouteAssessmentV1Schema.safeParse({
        ...assessment,
        checks: [{ code: "PROVIDER_RESPONSE", result: "UNKNOWN" }],
      }).success,
    ).toBe(false);
    expect(
      RouteAssessmentV1Schema.safeParse({
        ...assessment,
        reasons: ["ONEINCH_UNAVAILABLE"],
      }).success,
    ).toBe(false);
  });
});

describe("MandateSnapshotV1Schema", () => {
  it("carries the exact immutable strategy required for public inspection", () => {
    expect(
      MandateSnapshotV1Schema.parse({
        version: 1,
        chainId: "11155111",
        strategyHash: hash("a"),
        block: { number: "11648628", hash: hash("b") },
        strategy: validStrategy,
        aqua: {
          address: address("c"),
          result: "PASS",
          inputBalance: "1000",
          outputBalance: "0",
        },
        physical: {
          result: "PASS",
          makerTokenIn: "1000",
          makerTokenOut: "0",
          agentTokenIn: "0",
          agentTokenOut: "0",
          appTokenIn: "0",
          appTokenOut: "0",
        },
        state: { maker: validStrategy.maker, usedInput: "0", activated: true, revoked: false },
        ens: {
          status: "REGISTERED",
          tokenId: "1",
          owner: validStrategy.agent,
          expiry: "1788626400",
          address: validStrategy.agent,
        },
        result: "PASS",
      }),
    ).toMatchObject({ strategy: validStrategy });
  });
});

describe("CanonicalReceiptEvidenceV1Schema", () => {
  const validEvidence = {
    version: 1,
    strategy: validStrategy,
    execution: {
      version: 1,
      chainId: "11155111",
      txHash: hash("1"),
      block: { number: "11634851", hash: hash("2") },
      transactionIndex: "3",
      strategyHash: hash("3"),
      caller: address("2"),
      amountIn: "10",
      amountOut: "20",
      usedInputAfter: "10",
      status: "CONFIRMED",
    },
    audit: {
      version: 1,
      result: "COMPLIANT",
      chainId: "11155111",
      txHash: hash("1"),
      block: { number: "11634851", hash: hash("2") },
      strategyHash: hash("3"),
      checks: [],
      evidence: [{ provider: "rpc-receipt", responseHash: hash("4") }],
    },
    events: [
      {
        logIndex: "0",
        contract: address("8"),
        topic0: hash("5"),
        topics: [hash("5")],
        data: "0x",
        kind: "MandateExecuted",
        decoded: { strategyHash: hash("3") },
        decoderVersion: 1,
      },
    ],
    balanceDeltas: [
      {
        account: address("1"),
        token: address("6"),
        beforeBlock: { number: "11634850", hash: hash("6") },
        afterBlock: { number: "11634851", hash: hash("2") },
        before: "10",
        after: "0",
        delta: "-10",
        source: "RPC_CALL",
      },
    ],
  } as const;

  it("accepts a confirmed receipt bound to one strategy and one canonical block", () => {
    expect(CanonicalReceiptEvidenceV1Schema.parse(validEvidence)).toEqual(validEvidence);
  });

  it("rejects inconsistent audit bindings and malformed raw event bytes", () => {
    expect(
      CanonicalReceiptEvidenceV1Schema.safeParse({
        ...validEvidence,
        audit: { ...validEvidence.audit, txHash: hash("9") },
      }).success,
    ).toBe(false);
    expect(
      CanonicalReceiptEvidenceV1Schema.safeParse({
        ...validEvidence,
        events: [{ ...validEvidence.events[0], data: "0x0" }],
      }).success,
    ).toBe(false);
    expect(
      CanonicalReceiptEvidenceV1Schema.safeParse({
        ...validEvidence,
        execution: { ...validEvidence.execution, transactionIndex: "03" },
      }).success,
    ).toBe(false);
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

  it("admits the checked-in Sepolia authority runtime evidence", () => {
    const manifest = DeploymentManifestV1Schema.parse(sepoliaManifest);
    expect(manifest.contracts.map(({ kind }) => kind)).toEqual([
      "AQUA",
      "ENS_REGISTRY",
      "ENS_RESOLVER",
      "ENS_REGISTRY",
      "ENS_RESOLVER",
      "MANDATE_APP",
      "SWAP_TARGET",
    ]);
    expect(manifest.tokens.map(({ symbol, decimals }) => ({ symbol, decimals }))).toEqual([
      { symbol: "USDC", decimals: 6 },
      { symbol: "DAI", decimals: 18 },
    ]);
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

const validPolicyProfile = {
  agent: { name: "agent.mandate-test.eth", address: address("2") },
  ens: {
    registry: address("3"),
    resolver: address("4"),
    label: "agent",
    node: hash("5"),
  },
  tokenIn: { symbol: "USDC", address: address("6"), decimals: 6 },
  tokenOut: { symbol: "DAI", address: address("7"), decimals: 18 },
  route: { target: address("8"), selector: "0x12345678" },
} as const;

describe("PolicyProfileV1Schema", () => {
  it("parses a complete policy profile JSON without returning partial policy", () => {
    expect(parsePolicyProfileJson(JSON.stringify(validPolicyProfile))).toEqual(validPolicyProfile);
    expect(
      parsePolicyProfileJson(JSON.stringify({ ...validPolicyProfile, extra: true })),
    ).toBeUndefined();
    expect(
      parsePolicyProfileJson(
        JSON.stringify({
          ...validPolicyProfile,
          route: { ...validPolicyProfile.route, selector: "0x0" },
        }),
      ),
    ).toBeUndefined();
    expect(PolicyProfileV1Schema.safeParse({ ...validPolicyProfile, extra: true }).success).toBe(
      false,
    );
  });
});

describe("DemoExecution wire schemas", () => {
  const confirmed = {
    status: "CONFIRMED",
    txHash: hash("1"),
    execution: {
      version: 1,
      chainId: "11155111",
      txHash: hash("1"),
      block: { number: "11634851", hash: hash("2") },
      transactionIndex: "0",
      strategyHash: hash("3"),
      caller: address("2"),
      amountIn: "10",
      amountOut: "20",
      usedInputAfter: "10",
      status: "CONFIRMED",
    },
    audit: {
      version: 1,
      result: "COMPLIANT",
      chainId: "11155111",
      txHash: hash("1"),
      block: { number: "11634851", hash: hash("2") },
      strategyHash: hash("3"),
      checks: [],
      evidence: [{ provider: "rpc-receipt", responseHash: hash("4") }],
    },
  } as const;

  it("admits only chain ID and strategy hash in a demo request", () => {
    const request = { chainId: "11155111", strategyHash: hash("3") };

    expect(DemoExecutionRequestV1Schema.parse(request)).toEqual(request);
    for (const field of ["to", "data", "value", "amountIn", "surprise"] as const) {
      expect(
        DemoExecutionRequestV1Schema.safeParse({ ...request, [field]: "untrusted" }).success,
      ).toBe(false);
    }
  });

  it("admits all safe terminal result variants and rejects mismatched receipt evidence", () => {
    expect(DemoExecutionResultV1Schema.parse(confirmed)).toEqual(confirmed);
    expect(
      DemoExecutionResultV1Schema.parse({ status: "REJECTED", reason: "MANDATE_REVOKED" }),
    ).toEqual({
      status: "REJECTED",
      reason: "MANDATE_REVOKED",
    });
    expect(DemoExecutionResultV1Schema.parse({ status: "UNKNOWN", errorId: hash("5") })).toEqual({
      status: "UNKNOWN",
      errorId: hash("5"),
    });
    expect(
      DemoExecutionResultV1Schema.safeParse({
        ...confirmed,
        audit: { ...confirmed.audit, strategyHash: hash("9") },
      }).success,
    ).toBe(false);
  });
});
