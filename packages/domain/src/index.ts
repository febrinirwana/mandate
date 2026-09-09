import { z } from "zod";

const DECIMAL = /^(?:0|[1-9][0-9]*)$/;
const ADDRESS = /^0x[0-9a-f]{40}$/;
const HASH32 = /^0x[0-9a-f]{64}$/;
const SELECTOR = /^0x[0-9a-f]{8}$/;
const ENS_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const UINT64_MAX = 18_446_744_073_709_551_615n;
const UINT256_MAX =
  115_792_089_237_316_195_423_570_985_008_687_907_853_269_984_665_640_564_039_457_584_007_913_129_639_935n;

const nonZeroAddress = (value: string) => value !== `0x${"0".repeat(40)}`;
const nonZeroHash = (value: string) => value !== `0x${"0".repeat(64)}`;
const nonZeroSelector = (value: string) => value !== "0x00000000";

export const AddressSchema = z.string().regex(ADDRESS) as z.ZodType<`0x${string}`>;
export const Hash32Schema = z.string().regex(HASH32) as z.ZodType<`0x${string}`>;
export const SelectorSchema = z.string().regex(SELECTOR) as z.ZodType<`0x${string}`>;
export const DecimalStringSchema = z.string().regex(DECIMAL);
export const PositiveDecimalStringSchema = DecimalStringSchema.refine((value) => value !== "0");
export const Uint64StringSchema = DecimalStringSchema.refine(
  (value) => DECIMAL.test(value) && BigInt(value) <= UINT64_MAX,
);
export const Uint256StringSchema = DecimalStringSchema.refine(
  (value) => DECIMAL.test(value) && BigInt(value) <= UINT256_MAX,
);
export const PositiveUint256StringSchema = Uint256StringSchema.refine((value) => value !== "0");
export const SignedUint256StringSchema = z
  .string()
  .regex(/^-?(?:0|[1-9][0-9]*)$/)
  .refine(
    (value) =>
      /^-?(?:0|[1-9][0-9]*)$/.test(value) &&
      BigInt(value.startsWith("-") ? value.slice(1) : value) <= UINT256_MAX,
  );

const NonZeroAddressSchema = AddressSchema.refine(nonZeroAddress);
const NonZeroHash32Schema = Hash32Schema.refine(nonZeroHash);
const NonZeroSelectorSchema = SelectorSchema.refine(nonZeroSelector);
const TimestampSchema = z.string().datetime({ offset: true });
const ChainIdSchema = PositiveUint256StringSchema;
const SimulationResultSchema = z.enum(["PASS", "FAIL", "UNKNOWN"]);
const AuditResultSchema = z.enum(["COMPLIANT", "NON_COMPLIANT", "UNKNOWN"]);

export const BlockRefSchema = z.strictObject({
  number: PositiveUint256StringSchema,
  hash: NonZeroHash32Schema,
});

export const StrategyV1Schema = z
  .strictObject({
    version: z.literal(1),
    maker: NonZeroAddressSchema,
    agent: NonZeroAddressSchema,
    ensRegistry: NonZeroAddressSchema,
    ensResolver: NonZeroAddressSchema,
    ensLabel: z.string().regex(ENS_LABEL),
    ensNode: NonZeroHash32Schema,
    tokenIn: NonZeroAddressSchema,
    tokenOut: NonZeroAddressSchema,
    swapTarget: NonZeroAddressSchema,
    swapSelector: NonZeroSelectorSchema,
    minRateNumerator: PositiveUint256StringSchema,
    minRateDenominator: PositiveUint256StringSchema,
    maxInputPerCall: PositiveUint256StringSchema,
    maxInputTotal: PositiveUint256StringSchema,
    validAfter: Uint64StringSchema,
    validUntil: Uint64StringSchema,
    salt: Hash32Schema,
  })
  .superRefine((strategy, context) => {
    if (strategy.tokenIn === strategy.tokenOut) {
      context.addIssue({
        code: "custom",
        message: "tokenIn and tokenOut must differ",
        path: ["tokenOut"],
      });
    }
    if (BigInt(strategy.maxInputPerCall) > BigInt(strategy.maxInputTotal)) {
      context.addIssue({
        code: "custom",
        message: "maxInputPerCall must not exceed maxInputTotal",
        path: ["maxInputPerCall"],
      });
    }
    if (BigInt(strategy.validAfter) >= BigInt(strategy.validUntil)) {
      context.addIssue({
        code: "custom",
        message: "validUntil must be greater than validAfter",
        path: ["validUntil"],
      });
    }
  });

const reasonCodes = [
  "INVALID_STRATEGY",
  "ALREADY_ACTIVATED",
  "MAKER_NOT_CALLER",
  "MANDATE_INACTIVE",
  "MANDATE_REVOKED",
  "MANDATE_NOT_STARTED",
  "MANDATE_EXPIRED",
  "CALLER_NOT_AGENT",
  "ENS_NOT_REGISTERED",
  "ENS_EXPIRED",
  "ENS_OWNER_MISMATCH",
  "ENS_ADDRESS_MISMATCH",
  "ENS_READ_UNAVAILABLE",
  "STRATEGY_HASH_MISMATCH",
  "AQUA_STRATEGY_INACTIVE",
  "AQUA_BALANCE_INSUFFICIENT",
  "AQUA_READ_UNAVAILABLE",
  "INVALID_AMOUNT",
  "PER_CALL_CAP_EXCEEDED",
  "TOTAL_CAP_EXCEEDED",
  "RATE_FLOOR_UNSATISFIED",
  "TARGET_MISMATCH",
  "SELECTOR_MISMATCH",
  "EXECUTION_DEADLINE_EXPIRED",
  "ROUTE_REVERTED",
  "ROUTE_CALL_FAILED",
  "INPUT_NOT_FULLY_SPENT",
  "INPUT_TRANSFER_MISMATCH",
  "OUTPUT_TOO_LOW",
  "ALLOWANCE_NOT_CLEARED",
  "RESIDUAL_BALANCE",
  "EVENT_UNDECODABLE",
  "TRACE_UNAVAILABLE",
  "REENTRANT_CALL",
  "TOKEN_OPERATION_FAILED",
  "SIMULATION_STALE",
  "RECEIPT_NOT_CANONICAL",
] as const;

export const ReasonCodeSchema = z.enum(reasonCodes);

export const SimulationBindingV1Schema = z.strictObject({
  chainId: ChainIdSchema,
  blockNumber: PositiveUint256StringSchema,
  blockHash: NonZeroHash32Schema,
  caller: NonZeroAddressSchema,
  to: NonZeroAddressSchema,
  calldataHash: NonZeroHash32Schema,
  strategyHash: NonZeroHash32Schema,
  expiresAt: TimestampSchema,
});

export const CheckV1Schema = z.strictObject({
  code: ReasonCodeSchema,
  result: SimulationResultSchema,
  detail: z.string().min(1).optional(),
});

export const SimulationV1Schema = z.strictObject({
  version: z.literal(1),
  id: NonZeroHash32Schema,
  result: SimulationResultSchema,
  reasons: z.array(ReasonCodeSchema),
  binding: SimulationBindingV1Schema,
  checks: z.array(CheckV1Schema),
  expectedMovement: z.strictObject({
    makerTokenInDelta: SignedUint256StringSchema,
    makerTokenOutMinimumDelta: SignedUint256StringSchema,
    agentTokenDelta: SignedUint256StringSchema,
  }),
});

export const MandateSnapshotV1Schema = z.strictObject({
  version: z.literal(1),
  chainId: ChainIdSchema,
  strategyHash: NonZeroHash32Schema,
  strategy: StrategyV1Schema,
  aqua: z.strictObject({
    address: AddressSchema,
    result: SimulationResultSchema,
    inputBalance: Uint256StringSchema,
    outputBalance: Uint256StringSchema,
  }),
  physical: z.strictObject({
    result: SimulationResultSchema,
    makerTokenIn: Uint256StringSchema,
    makerTokenOut: Uint256StringSchema,
    agentTokenIn: Uint256StringSchema,
    agentTokenOut: Uint256StringSchema,
    appTokenIn: Uint256StringSchema,
    appTokenOut: Uint256StringSchema,
  }),
  block: BlockRefSchema,
  state: z.strictObject({
    maker: NonZeroAddressSchema,
    usedInput: Uint256StringSchema,
    activated: z.boolean(),
    revoked: z.boolean(),
  }),
  ens: z.strictObject({
    status: z.string().min(1),
    tokenId: Uint256StringSchema,
    owner: AddressSchema,
    expiry: Uint64StringSchema,
    address: AddressSchema,
  }),
  result: SimulationResultSchema,
});

export const ReceiptAuditV1Schema = z.strictObject({
  version: z.literal(1),
  result: AuditResultSchema,
  chainId: ChainIdSchema,
  txHash: NonZeroHash32Schema,
  block: BlockRefSchema,
  strategyHash: NonZeroHash32Schema,
  checks: z.array(CheckV1Schema),
  evidence: z
    .array(
      z.strictObject({
        provider: z.string().min(1),
        responseHash: NonZeroHash32Schema,
      }),
    )
    .min(1),
});

const DeploymentProbeSchema = z.strictObject({
  method: z.string().min(1),
  resultHash: NonZeroHash32Schema,
});

const DeploymentRecordSchema = z.strictObject({
  kind: z.enum([
    "AQUA",
    "MANDATE_APP",
    "ENS_REGISTRY",
    "ENS_RESOLVER",
    "SWAP_TARGET",
    "SWAP_EXECUTOR",
  ]),
  name: z.string().min(1),
  enabled: z.boolean(),
  external: z.boolean(),
  official: z.boolean(),
  chainId: ChainIdSchema,
  address: NonZeroAddressSchema,
  codeHash: NonZeroHash32Schema,
  sourceRevision: z.string().regex(/^[0-9a-f]{40}$/),
  sourceUrl: z.url(),
  verificationBlock: BlockRefSchema,
  verifiedAt: TimestampSchema,
  probes: z.array(DeploymentProbeSchema).min(1),
});

const ManifestTokenSchema = z.strictObject({
  chainId: ChainIdSchema,
  address: NonZeroAddressSchema,
  codeHash: NonZeroHash32Schema,
  decimals: z.int().min(0).max(255),
  symbol: z.string().min(1),
});

export const DeploymentManifestV1Schema = z
  .strictObject({
    version: z.literal(1),
    environment: z.string().min(1),
    chainId: ChainIdSchema,
    generatedAt: TimestampSchema,
    contracts: z.array(DeploymentRecordSchema).min(1),
    tokens: z.array(ManifestTokenSchema),
  })
  .superRefine((manifest, context) => {
    manifest.contracts.forEach((contract, index) => {
      if (contract.chainId !== manifest.chainId) {
        context.addIssue({
          code: "custom",
          message: "contract chainId must match manifest chainId",
          path: ["contracts", index, "chainId"],
        });
      }
    });
    manifest.tokens.forEach((token, index) => {
      if (token.chainId !== manifest.chainId) {
        context.addIssue({
          code: "custom",
          message: "token chainId must match manifest chainId",
          path: ["tokens", index, "chainId"],
        });
      }
    });
  });

export const HexBytesSchema = z.string().regex(/^0x(?:[0-9a-f]{2})+$/) as z.ZodType<`0x${string}`>;

export const SimulationRequestV1Schema = z.strictObject({
  chainId: ChainIdSchema,
  mandateApp: NonZeroAddressSchema,
  strategy: StrategyV1Schema,
  amountIn: PositiveUint256StringSchema,
  agentMinOut: Uint256StringSchema,
  executionDeadline: Uint64StringSchema,
  routeData: HexBytesSchema,
  blockNumber: PositiveUint256StringSchema.optional(),
  previous: z
    .strictObject({
      id: NonZeroHash32Schema,
      binding: SimulationBindingV1Schema,
    })
    .optional(),
});

export const ExecutionV1Schema = z.strictObject({
  version: z.literal(1),
  chainId: ChainIdSchema,
  txHash: NonZeroHash32Schema,
  block: BlockRefSchema,
  transactionIndex: Uint256StringSchema,
  strategyHash: NonZeroHash32Schema,
  caller: NonZeroAddressSchema,
  amountIn: PositiveUint256StringSchema,
  amountOut: PositiveUint256StringSchema,
  usedInputAfter: PositiveUint256StringSchema,
  status: z.enum(["CONFIRMED", "REVERTED", "REORGED"]),
});

const RawHexDataSchema = z.string().regex(/^0x(?:[0-9a-f]{2})*$/) as z.ZodType<`0x${string}`>;

export const ExecutionEventEvidenceV1Schema = z
  .strictObject({
    logIndex: Uint256StringSchema,
    contract: NonZeroAddressSchema,
    topic0: Hash32Schema.nullable(),
    topics: z.array(Hash32Schema).max(4),
    data: RawHexDataSchema,
    kind: z.string().min(1),
    decoded: z.record(z.string().min(1), z.string().min(1)),
    decoderVersion: z.int().positive(),
  })
  .superRefine((event, context) => {
    if (event.topics.length === 0 && event.topic0 !== null) {
      context.addIssue({
        code: "custom",
        message: "topic0 must be null when an event has no topics",
        path: ["topic0"],
      });
    }
    if (event.topics.length > 0 && event.topic0 !== event.topics[0]) {
      context.addIssue({
        code: "custom",
        message: "topic0 must equal the first event topic",
        path: ["topic0"],
      });
    }
  });

export const BalanceDeltaEvidenceV1Schema = z
  .strictObject({
    account: NonZeroAddressSchema,
    token: NonZeroAddressSchema,
    beforeBlock: BlockRefSchema,
    afterBlock: BlockRefSchema,
    before: Uint256StringSchema,
    after: Uint256StringSchema,
    delta: SignedUint256StringSchema,
    source: z.enum(["RPC_CALL", "EVENT_RECONSTRUCTION", "AQUA_RAW_BALANCE"]),
  })
  .superRefine((delta, context) => {
    if (BigInt(delta.beforeBlock.number) >= BigInt(delta.afterBlock.number)) {
      context.addIssue({
        code: "custom",
        message: "beforeBlock must precede afterBlock",
        path: ["beforeBlock"],
      });
    }
    if (BigInt(delta.after) - BigInt(delta.before) !== BigInt(delta.delta)) {
      context.addIssue({
        code: "custom",
        message: "delta must equal after minus before",
        path: ["delta"],
      });
    }
  });

export const CanonicalReceiptEvidenceV1Schema = z
  .strictObject({
    version: z.literal(1),
    strategy: StrategyV1Schema,
    execution: ExecutionV1Schema,
    audit: ReceiptAuditV1Schema,
    events: z.array(ExecutionEventEvidenceV1Schema),
    balanceDeltas: z.array(BalanceDeltaEvidenceV1Schema),
  })
  .superRefine((evidence, context) => {
    if (evidence.execution.status !== "CONFIRMED") {
      context.addIssue({
        code: "custom",
        message: "canonical evidence requires a confirmed execution",
        path: ["execution", "status"],
      });
    }
    const execution = evidence.execution;
    const audit = evidence.audit;
    if (
      execution.chainId !== audit.chainId ||
      execution.txHash !== audit.txHash ||
      execution.strategyHash !== audit.strategyHash ||
      execution.block.number !== audit.block.number ||
      execution.block.hash !== audit.block.hash
    ) {
      context.addIssue({
        code: "custom",
        message: "execution and audit must share one chain, transaction, strategy, and block",
        path: ["audit"],
      });
    }
    evidence.balanceDeltas.forEach((delta, index) => {
      if (
        delta.afterBlock.number !== execution.block.number ||
        delta.afterBlock.hash !== execution.block.hash
      ) {
        context.addIssue({
          code: "custom",
          message: "balance delta afterBlock must match the execution block",
          path: ["balanceDeltas", index, "afterBlock"],
        });
      }
    });
  });

const VenueRouteV1Schema = z.strictObject({
  provider: z.literal("1inch-classic-swap-v6.1"),
  chainId: z.literal("1"),
  apiVersion: z.literal("v6.1"),
  endpoint: z.literal("https://api.1inch.com/swap/v6.1/1/swap"),
  requestId: z.string().min(1),
  requestedAt: TimestampSchema,
  responseHash: NonZeroHash32Schema,
  target: NonZeroAddressSchema,
  selector: z.literal("0x07ed2379"),
  calldataSchema: z.literal(
    "swap(address,(address,address,address,address,uint256,uint256,uint256),bytes)",
  ),
  calldata: HexBytesSchema,
  calldataHash: NonZeroHash32Schema,
  caller: NonZeroAddressSchema,
  executor: NonZeroAddressSchema,
  recipient: NonZeroAddressSchema,
  tokenIn: NonZeroAddressSchema,
  tokenOut: NonZeroAddressSchema,
  amountIn: PositiveUint256StringSchema,
  quotedAmountOut: PositiveUint256StringSchema,
  routeMinimumOut: PositiveUint256StringSchema,
  nativeValue: z.literal("0"),
  allowPartialFill: z.literal(false),
  deadline: z.null(),
  protocols: z.array(z.string().regex(/^[A-Z0-9_]+$/)).min(1),
});
const VenueContractRecordSchema = DeploymentRecordSchema.extend({
  sourceRevision: z.string().min(1),
});

export const VenueManifestV1Schema = z
  .strictObject({
    version: z.literal(1),
    environment: z.literal("ETHEREUM_MAINNET_FORK"),
    chainId: z.literal("1"),
    generatedAt: TimestampSchema,
    verificationBlock: BlockRefSchema,
    contracts: z.array(VenueContractRecordSchema).min(3),
    tokens: z.array(ManifestTokenSchema).length(2),
    route: VenueRouteV1Schema,
  })
  .superRefine((manifest, context) => {
    manifest.contracts.forEach((contract, index) => {
      if (contract.chainId !== manifest.chainId) {
        context.addIssue({
          code: "custom",
          message: "contract chainId must match venue manifest chainId",
          path: ["contracts", index, "chainId"],
        });
      }
      if (
        contract.verificationBlock.number !== manifest.verificationBlock.number ||
        contract.verificationBlock.hash !== manifest.verificationBlock.hash
      ) {
        context.addIssue({
          code: "custom",
          message: "contract must be verified at the venue manifest block",
          path: ["contracts", index, "verificationBlock"],
        });
      }
    });
    manifest.tokens.forEach((token, index) => {
      if (token.chainId !== manifest.chainId) {
        context.addIssue({
          code: "custom",
          message: "token chainId must match venue manifest chainId",
          path: ["tokens", index, "chainId"],
        });
      }
    });

    const route = manifest.route;
    if (route.caller !== route.recipient) {
      context.addIssue({
        code: "custom",
        message: "route caller and recipient must both be the Mandate app",
        path: ["route", "recipient"],
      });
    }
    if (route.tokenIn === route.tokenOut) {
      context.addIssue({
        code: "custom",
        message: "route tokens must differ",
        path: ["route", "tokenOut"],
      });
    }
    if (!route.calldata.startsWith(route.selector)) {
      context.addIssue({
        code: "custom",
        message: "route selector must match calldata",
        path: ["route", "calldata"],
      });
    }
    if (BigInt(route.routeMinimumOut) > BigInt(route.quotedAmountOut)) {
      context.addIssue({
        code: "custom",
        message: "route minimum output cannot exceed quoted output",
        path: ["route", "routeMinimumOut"],
      });
    }
    if (
      !manifest.contracts.some(
        (contract) =>
          contract.kind === "SWAP_TARGET" && contract.enabled && contract.address === route.target,
      )
    ) {
      context.addIssue({
        code: "custom",
        message: "route target must be an enabled SWAP_TARGET contract",
        path: ["route", "target"],
      });
    }
    if (
      !manifest.contracts.some(
        (contract) =>
          contract.kind === "SWAP_EXECUTOR" &&
          contract.enabled &&
          contract.address === route.executor,
      )
    ) {
      context.addIssue({
        code: "custom",
        message: "route executor must be an enabled SWAP_EXECUTOR contract",
        path: ["route", "executor"],
      });
    }
    for (const [field, tokenAddress] of [
      ["tokenIn", route.tokenIn],
      ["tokenOut", route.tokenOut],
    ] as const) {
      if (!manifest.tokens.some((token) => token.address === tokenAddress)) {
        context.addIssue({
          code: "custom",
          message: `${field} must be recorded in venue manifest tokens`,
          path: ["route", field],
        });
      }
    }
  });

export const jsonSchemas = {
  strategyV1: z.toJSONSchema(StrategyV1Schema),
  simulationBindingV1: z.toJSONSchema(SimulationBindingV1Schema),
  checkV1: z.toJSONSchema(CheckV1Schema),
  mandateSnapshotV1: z.toJSONSchema(MandateSnapshotV1Schema),
  receiptAuditV1: z.toJSONSchema(ReceiptAuditV1Schema),
  simulationRequestV1: z.toJSONSchema(SimulationRequestV1Schema),
  executionV1: z.toJSONSchema(ExecutionV1Schema),
  canonicalReceiptEvidenceV1: z.toJSONSchema(CanonicalReceiptEvidenceV1Schema),
  deploymentManifestV1: z.toJSONSchema(DeploymentManifestV1Schema),
  venueManifestV1: z.toJSONSchema(VenueManifestV1Schema),
} as const;

export type Address = z.infer<typeof AddressSchema>;
export type Hash32 = z.infer<typeof Hash32Schema>;
export type DecimalString = z.infer<typeof DecimalStringSchema>;
export type PositiveDecimalString = z.infer<typeof PositiveDecimalStringSchema>;
export type Selector = z.infer<typeof SelectorSchema>;
export type Uint256String = z.infer<typeof Uint256StringSchema>;
export type PositiveUint256String = z.infer<typeof PositiveUint256StringSchema>;
export type Uint64String = z.infer<typeof Uint64StringSchema>;
export type HexBytes = z.infer<typeof HexBytesSchema>;
export type BlockRef = z.infer<typeof BlockRefSchema>;
export type StrategyV1 = z.infer<typeof StrategyV1Schema>;
export type ReasonCode = z.infer<typeof ReasonCodeSchema>;
export type SignedUint256String = z.infer<typeof SignedUint256StringSchema>;
export type SimulationBindingV1 = z.infer<typeof SimulationBindingV1Schema>;
export type CheckV1 = z.infer<typeof CheckV1Schema>;
export type MandateSnapshotV1 = z.infer<typeof MandateSnapshotV1Schema>;
export type ReceiptAuditV1 = z.infer<typeof ReceiptAuditV1Schema>;
export type SimulationRequestV1 = z.infer<typeof SimulationRequestV1Schema>;
export type ExecutionV1 = z.infer<typeof ExecutionV1Schema>;
export type ExecutionEventEvidenceV1 = z.infer<typeof ExecutionEventEvidenceV1Schema>;
export type BalanceDeltaEvidenceV1 = z.infer<typeof BalanceDeltaEvidenceV1Schema>;
export type CanonicalReceiptEvidenceV1 = z.infer<typeof CanonicalReceiptEvidenceV1Schema>;
export type DeploymentManifestV1 = z.infer<typeof DeploymentManifestV1Schema>;
export type VenueManifestV1 = z.infer<typeof VenueManifestV1Schema>;
export type SimulationV1 = z.infer<typeof SimulationV1Schema>;
