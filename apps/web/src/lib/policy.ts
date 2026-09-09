import { StrategyV1Schema, type Address, type StrategyV1 } from "@mandate/domain";
import { parseUnits } from "viem";

export type PolicyProfileV1 = {
  agent: { name: string; address: Address };
  ens: { registry: Address; resolver: Address; label: string; node: `0x${string}` };
  tokenIn: { symbol: string; address: Address; decimals: number };
  tokenOut: { symbol: string; address: Address; decimals: number };
  route: { target: Address; selector: `0x${string}` };
};

export type PolicyDraftV1 = {
  version: 1;
  intent: string;
  agent: string;
  tokenIn: string;
  tokenOut: string;
  maxInput: string;
  minRate: string;
  expiresAt: string;
};

type PolicyCompilationContext = {
  maker: Address;
  validAfter: string;
  salt: `0x${string}`;
};

const DECIMAL = /^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/;

function greatestCommonDivisor(left: bigint, right: bigint): bigint {
  while (right !== 0n) [left, right] = [right, left % right];
  return left;
}

function decimalFraction(value: string): [bigint, bigint] {
  if (!DECIMAL.test(value)) throw new Error("rate must be a positive decimal");
  const [whole, fraction = ""] = value.split(".");
  const denominator = 10n ** BigInt(fraction.length);
  const numerator = BigInt(`${whole}${fraction}`);
  if (numerator === 0n) throw new Error("rate must be greater than zero");
  return [numerator, denominator];
}

function minimumRate(value: string, inputDecimals: number, outputDecimals: number): [string, string] {
  let [numerator, denominator] = decimalFraction(value);
  numerator *= 10n ** BigInt(outputDecimals);
  denominator *= 10n ** BigInt(inputDecimals);
  const divisor = greatestCommonDivisor(numerator, denominator);
  return [(numerator / divisor).toString(), (denominator / divisor).toString()];
}

function unixSeconds(value: string): string {
  const milliseconds = Date.parse(value);
  if (Number.isNaN(milliseconds) || milliseconds % 1000 !== 0) throw new Error("expiry must be a whole-second ISO timestamp");
  return String(milliseconds / 1000);
}

export function compilePolicy(
  draft: PolicyDraftV1,
  profile: PolicyProfileV1,
  context: PolicyCompilationContext,
): StrategyV1 {
  if (draft.version !== 1 || !draft.intent.trim()) throw new Error("policy intent is required");
  if (draft.agent !== profile.agent.name) throw new Error("agent is not in the trusted policy profile");
  if (draft.tokenIn !== profile.tokenIn.symbol || draft.tokenOut !== profile.tokenOut.symbol) {
    throw new Error("asset pair is not in the trusted policy profile");
  }
  if (!DECIMAL.test(draft.maxInput) || draft.maxInput === "0") throw new Error("maximum spend must be positive");

  const maxInputTotal = parseUnits(draft.maxInput, profile.tokenIn.decimals).toString();
  const [minRateNumerator, minRateDenominator] = minimumRate(
    draft.minRate,
    profile.tokenIn.decimals,
    profile.tokenOut.decimals,
  );
  const validUntil = unixSeconds(draft.expiresAt);

  return StrategyV1Schema.parse({
    version: 1,
    maker: context.maker.toLowerCase(),
    agent: profile.agent.address.toLowerCase(),
    ensRegistry: profile.ens.registry.toLowerCase(),
    ensResolver: profile.ens.resolver.toLowerCase(),
    ensLabel: profile.ens.label,
    ensNode: profile.ens.node.toLowerCase(),
    tokenIn: profile.tokenIn.address.toLowerCase(),
    tokenOut: profile.tokenOut.address.toLowerCase(),
    swapTarget: profile.route.target.toLowerCase(),
    swapSelector: profile.route.selector.toLowerCase(),
    minRateNumerator,
    minRateDenominator,
    maxInputPerCall: maxInputTotal,
    maxInputTotal,
    validAfter: context.validAfter,
    validUntil,
    salt: context.salt.toLowerCase(),
  });
}
