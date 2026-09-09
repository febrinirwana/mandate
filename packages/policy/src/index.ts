import type { Address, CheckV1, ReasonCode, StrategyV1 } from "@mandate/domain";

interface MandateStateInput {
  maker: Address;
  usedInput: string;
  activated: boolean;
  revoked: boolean;
}

interface EnsIdentityAvailable {
  available: true;
  status: string;
  owner: Address;
  resolver: Address;
  address: Address;
  expiry: string;
}

interface EnsIdentityUnavailable {
  available: false;
}

interface AquaStateAvailable {
  available: true;
  active: boolean;
  inputBalance: string;
}

interface AquaStateUnavailable {
  available: false;
}

export interface PreflightInputV1 {
  strategy: StrategyV1;
  mandate: MandateStateInput;
  ens: EnsIdentityAvailable | EnsIdentityUnavailable;
  aqua: AquaStateAvailable | AquaStateUnavailable;
  request: {
    caller: Address;
    amountIn: string;
    agentMinOut: string;
    executionDeadline: string;
    routeData: `0x${string}`;
  };
  blockTimestamp: string;
}

export interface PolicyEvaluationV1 {
  result: "PASS" | "FAIL" | "UNKNOWN";
  reasons: ReasonCode[];
  checks: CheckV1[];
  minimumOutput: string;
}

export function minimumOutput(amountIn: bigint, numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) throw new Error("rate denominator must be positive");
  return (amountIn * numerator + denominator - 1n) / denominator;
}

function resultCheck(code: ReasonCode, passes: boolean, detail?: string): CheckV1 {
  return detail === undefined
    ? { code, result: passes ? "PASS" : "FAIL" }
    : { code, result: passes ? "PASS" : "FAIL", detail };
}

function unavailableCheck(code: ReasonCode): CheckV1 {
  return { code, result: "UNKNOWN" };
}

export function evaluatePreflight(input: PreflightInputV1): PolicyEvaluationV1 {
  const amountIn = BigInt(input.request.amountIn);
  const usedInput = BigInt(input.mandate.usedInput);
  const blockTimestamp = BigInt(input.blockTimestamp);
  const checks: CheckV1[] = [
    resultCheck(
      "MANDATE_INACTIVE",
      input.mandate.activated && input.mandate.maker === input.strategy.maker,
    ),
    resultCheck("MANDATE_REVOKED", !input.mandate.revoked),
    resultCheck("MANDATE_NOT_STARTED", blockTimestamp >= BigInt(input.strategy.validAfter)),
    resultCheck("MANDATE_EXPIRED", blockTimestamp < BigInt(input.strategy.validUntil)),
    resultCheck(
      "EXECUTION_DEADLINE_EXPIRED",
      blockTimestamp <= BigInt(input.request.executionDeadline),
    ),
    resultCheck("CALLER_NOT_AGENT", input.request.caller === input.strategy.agent),
  ];

  if (!input.ens.available) {
    checks.push(unavailableCheck("ENS_READ_UNAVAILABLE"));
  } else {
    checks.push(
      resultCheck("ENS_NOT_REGISTERED", input.ens.status === "REGISTERED"),
      resultCheck("ENS_EXPIRED", BigInt(input.ens.expiry) > blockTimestamp),
      resultCheck("ENS_OWNER_MISMATCH", input.ens.owner === input.strategy.agent),
      resultCheck(
        "ENS_ADDRESS_MISMATCH",
        input.ens.resolver === input.strategy.ensResolver &&
          input.ens.address === input.strategy.agent,
      ),
    );
  }

  checks.push(
    resultCheck("INVALID_AMOUNT", amountIn > 0n),
    resultCheck("PER_CALL_CAP_EXCEEDED", amountIn <= BigInt(input.strategy.maxInputPerCall)),
    resultCheck("TOTAL_CAP_EXCEEDED", usedInput + amountIn <= BigInt(input.strategy.maxInputTotal)),
    resultCheck(
      "SELECTOR_MISMATCH",
      input.request.routeData.length >= 10 &&
        input.request.routeData.slice(0, 10) === input.strategy.swapSelector,
    ),
  );

  if (!input.aqua.available) {
    checks.push(unavailableCheck("AQUA_READ_UNAVAILABLE"));
  } else {
    checks.push(
      resultCheck("AQUA_STRATEGY_INACTIVE", input.aqua.active),
      resultCheck("AQUA_BALANCE_INSUFFICIENT", BigInt(input.aqua.inputBalance) >= amountIn),
    );
  }

  const failed = checks.filter((check) => check.result === "FAIL");
  const unknown = checks.filter((check) => check.result === "UNKNOWN");
  const reasons = (failed.length > 0 ? failed : unknown).map((check) => check.code);

  return {
    result: failed.length > 0 ? "FAIL" : unknown.length > 0 ? "UNKNOWN" : "PASS",
    reasons,
    checks,
    minimumOutput: minimumOutput(
      amountIn,
      BigInt(input.strategy.minRateNumerator),
      BigInt(input.strategy.minRateDenominator),
    ).toString(),
  };
}

export function explainCheck(check: CheckV1): string {
  return check.detail ?? `${check.code}: ${check.result}`;
}
