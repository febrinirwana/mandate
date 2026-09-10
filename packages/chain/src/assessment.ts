import {
  RouteAssessmentRequestV1Schema,
  RouteAssessmentV1Schema,
  type Address,
  type RouteAssessmentReason,
  type RouteAssessmentRequestV1,
  type RouteAssessmentV1,
} from "@mandate/domain";
import { keccak256, toHex } from "viem";

import { buildExecutionCall } from "./mandate.js";
import {
  admitClassicSwapRoute,
  CLASSIC_SWAP_SELECTOR,
  ONEINCH_AGGREGATION_ROUTER_V6,
  RouteAdmissionError,
  type AdmittedClassicSwapRoute,
} from "./route.js";

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return JSON.stringify(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(",")}}`;
  }
  throw new Error("route evidence contains a non-JSON value");
}

function evidenceHash(value: unknown): `0x${string}` {
  return keccak256(toHex(canonicalJson(value)));
}

function baseAssessment(
  input: RouteAssessmentRequestV1,
  strategyHash: `0x${string}`,
  providerHash: `0x${string}`,
  assessedAt: Date,
) {
  return {
    version: 1 as const,
    chainId: "1" as const,
    strategyHash,
    assessedAt: assessedAt.toISOString(),
    request: {
      mandateApp: input.mandateApp,
      amountIn: input.amountIn,
      agentMinOut: input.agentMinOut,
      executionDeadline: input.executionDeadline,
    },
    evidence: [
      { provider: "1inch-classic-swap-v6.1" as const, responseHash: providerHash },
      { provider: "mandate-strategy" as const, responseHash: strategyHash },
    ],
  };
}

function unknownAssessment(
  input: RouteAssessmentRequestV1,
  strategyHash: `0x${string}`,
  reason: "ONEINCH_UNAVAILABLE" | "ONEINCH_RESPONSE_INVALID",
  assessedAt: Date,
): RouteAssessmentV1 {
  return RouteAssessmentV1Schema.parse({
    ...baseAssessment(input, strategyHash, evidenceHash(input.provider), assessedAt),
    result: "UNKNOWN",
    reasons: [reason],
    route: null,
    checks: [{ code: "PROVIDER_RESPONSE", result: "UNKNOWN" }],
  });
}

function publicRoute(route: AdmittedClassicSwapRoute): NonNullable<RouteAssessmentV1["route"]> {
  return {
    provider: route.provider,
    requestId: route.requestId,
    target: route.target.toLowerCase() as Address,
    selector: route.selector,
    executor: route.executor.toLowerCase() as Address,
    caller: route.caller.toLowerCase() as Address,
    recipient: route.recipient.toLowerCase() as Address,
    tokenIn: route.tokenIn.toLowerCase() as Address,
    tokenOut: route.tokenOut.toLowerCase() as Address,
    amountIn: route.amountIn,
    quotedAmountOut: route.quotedAmountOut,
    routeMinimumOut: route.routeMinimumOut,
    nativeValue: route.nativeValue,
    allowPartialFill: route.allowPartialFill,
    protocols: route.protocols,
  };
}

export function assessClassicSwapRoute(
  rawInput: RouteAssessmentRequestV1,
  assessedAt: Date,
): RouteAssessmentV1 {
  const input = RouteAssessmentRequestV1Schema.parse(rawInput);
  const strategyHash = buildExecutionCall({
    strategy: input.strategy,
    amountIn: input.amountIn,
    agentMinOut: input.agentMinOut,
    executionDeadline: input.executionDeadline,
    routeData: "0x00",
  }).strategyHash;

  if (input.provider.status === "UNAVAILABLE") {
    return unknownAssessment(input, strategyHash, "ONEINCH_UNAVAILABLE", assessedAt);
  }

  let route: AdmittedClassicSwapRoute;
  try {
    route = admitClassicSwapRoute(
      input.provider.response,
      {
        chainId: 1,
        router: input.strategy.swapTarget,
        srcToken: input.strategy.tokenIn,
        dstToken: input.strategy.tokenOut,
        amount: BigInt(input.amountIn),
        caller: input.mandateApp,
        recipient: input.mandateApp,
        protocols: input.protocols,
      },
      input.provider.requestId,
    );
  } catch (error) {
    if (!(error instanceof RouteAdmissionError) || error.reason === "ONEINCH_RESPONSE_INVALID") {
      return unknownAssessment(input, strategyHash, "ONEINCH_RESPONSE_INVALID", assessedAt);
    }
    return RouteAssessmentV1Schema.parse({
      ...baseAssessment(input, strategyHash, evidenceHash(input.provider), assessedAt),
      result: "FAIL",
      reasons: [error.reason],
      route: null,
      checks: [
        { code: "PROVIDER_RESPONSE", result: "PASS" },
        { code: "ROUTE_BINDINGS", result: "FAIL" },
      ],
    });
  }

  const amountIn = BigInt(input.amountIn);
  const agentMinOut = BigInt(input.agentMinOut);
  const rateNumerator = BigInt(input.strategy.minRateNumerator);
  const rateDenominator = BigInt(input.strategy.minRateDenominator);
  const mandateMinimumOut = (amountIn * rateNumerator + rateDenominator - 1n) / rateDenominator;
  const assessedAtSeconds = BigInt(Math.floor(assessedAt.getTime() / 1000));
  const executionDeadline = BigInt(input.executionDeadline);
  const validAfter = BigInt(input.strategy.validAfter);
  const validUntil = BigInt(input.strategy.validUntil);
  const checks: RouteAssessmentV1["checks"] = [
    { code: "PROVIDER_RESPONSE", result: "PASS" },
    { code: "ROUTE_BINDINGS", result: "PASS" },
    {
      code: "POLICY_TARGET",
      result:
        input.strategy.swapTarget === ONEINCH_AGGREGATION_ROUTER_V6.toLowerCase() ? "PASS" : "FAIL",
    },
    {
      code: "POLICY_SELECTOR",
      result: input.strategy.swapSelector === CLASSIC_SWAP_SELECTOR ? "PASS" : "FAIL",
    },
    {
      code: "PER_CALL_CAP",
      result: amountIn <= BigInt(input.strategy.maxInputPerCall) ? "PASS" : "FAIL",
    },
    { code: "RATE_FLOOR", result: agentMinOut >= mandateMinimumOut ? "PASS" : "FAIL" },
    {
      code: "ROUTE_MINIMUM",
      result: BigInt(route.routeMinimumOut) >= agentMinOut ? "PASS" : "FAIL",
    },
    {
      code: "EXECUTION_WINDOW",
      result:
        assessedAtSeconds >= validAfter &&
        assessedAtSeconds <= executionDeadline &&
        executionDeadline <= validUntil
          ? "PASS"
          : "FAIL",
    },
  ];
  const reasons: RouteAssessmentReason[] = [];
  if (checks[2]?.result === "FAIL") reasons.push("TARGET_MISMATCH");
  if (checks[3]?.result === "FAIL") reasons.push("SELECTOR_MISMATCH");
  if (checks[4]?.result === "FAIL") reasons.push("PER_CALL_CAP_EXCEEDED");
  if (checks[5]?.result === "FAIL") reasons.push("RATE_FLOOR_UNSATISFIED");
  if (checks[6]?.result === "FAIL") reasons.push("ROUTE_MINIMUM_UNSATISFIED");
  if (checks[7]?.result === "FAIL") reasons.push("EXECUTION_DEADLINE_INVALID");

  return RouteAssessmentV1Schema.parse({
    ...baseAssessment(input, strategyHash, evidenceHash(input.provider), assessedAt),
    result: reasons.length === 0 ? "PASS" : "FAIL",
    reasons,
    route: publicRoute(route),
    checks,
  });
}
