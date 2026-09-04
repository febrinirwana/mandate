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

export const AddressSchema = z.string().regex(ADDRESS);
export const Hash32Schema = z.string().regex(HASH32);
export const SelectorSchema = z.string().regex(SELECTOR);
export const DecimalStringSchema = z.string().regex(DECIMAL);
export const PositiveDecimalStringSchema = DecimalStringSchema.refine((value) => value !== "0");
export const Uint64StringSchema = DecimalStringSchema.refine(
  (value) => BigInt(value) <= UINT64_MAX,
);
export const Uint256StringSchema = DecimalStringSchema.refine(
  (value) => BigInt(value) <= UINT256_MAX,
);
export const PositiveUint256StringSchema = Uint256StringSchema.refine((value) => value !== "0");
export const SignedUint256StringSchema = z
  .string()
  .regex(/^-?(?:0|[1-9][0-9]*)$/)
  .refine((value) => BigInt(value.startsWith("-") ? value.slice(1) : value) <= UINT256_MAX);

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
  "INPUT_NOT_FULLY_SPENT",
  "OUTPUT_TOO_LOW",
  "ALLOWANCE_NOT_CLEARED",
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
  kind: z.enum(["AQUA", "MANDATE_APP", "ENS_REGISTRY", "ENS_RESOLVER", "SWAP_TARGET"]),
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

export const jsonSchemas = {
  strategyV1: z.toJSONSchema(StrategyV1Schema),
  simulationBindingV1: z.toJSONSchema(SimulationBindingV1Schema),
  checkV1: z.toJSONSchema(CheckV1Schema),
  mandateSnapshotV1: z.toJSONSchema(MandateSnapshotV1Schema),
  receiptAuditV1: z.toJSONSchema(ReceiptAuditV1Schema),
  deploymentManifestV1: z.toJSONSchema(DeploymentManifestV1Schema),
} as const;

export type Address = z.infer<typeof AddressSchema>;
export type Hash32 = z.infer<typeof Hash32Schema>;
export type DecimalString = z.infer<typeof DecimalStringSchema>;
export type PositiveDecimalString = z.infer<typeof PositiveDecimalStringSchema>;
export type Selector = z.infer<typeof SelectorSchema>;
export type Uint256String = z.infer<typeof Uint256StringSchema>;
export type PositiveUint256String = z.infer<typeof PositiveUint256StringSchema>;
export type Uint64String = z.infer<typeof Uint64StringSchema>;
export type BlockRef = z.infer<typeof BlockRefSchema>;
export type StrategyV1 = z.infer<typeof StrategyV1Schema>;
export type ReasonCode = z.infer<typeof ReasonCodeSchema>;
export type SignedUint256String = z.infer<typeof SignedUint256StringSchema>;
export type SimulationBindingV1 = z.infer<typeof SimulationBindingV1Schema>;
export type CheckV1 = z.infer<typeof CheckV1Schema>;
export type MandateSnapshotV1 = z.infer<typeof MandateSnapshotV1Schema>;
export type ReceiptAuditV1 = z.infer<typeof ReceiptAuditV1Schema>;
export type DeploymentManifestV1 = z.infer<typeof DeploymentManifestV1Schema>;
export type SimulationV1 = z.infer<typeof SimulationV1Schema>;
