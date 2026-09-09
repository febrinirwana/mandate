import {
  MandateSnapshotV1Schema,
  SimulationRequestV1Schema,
  StrategyV1Schema,
  type MandateSnapshotV1,
  type SimulationBindingV1,
  type SimulationRequestV1,
  type StrategyV1,
} from "@mandate/domain";
import { mandateAquaAppAbi } from "@mandate/contracts/mandate-aqua-app";
import { encodeAbiParameters, encodeFunctionData, keccak256, type Hex } from "viem";

const strategyHashInputs = (() => {
  const entry = mandateAquaAppAbi.find(
    (candidate) => candidate.type === "function" && candidate.name === "strategyHash",
  );
  if (!entry || entry.type !== "function")
    throw new Error("Mandate ABI does not expose strategyHash");
  return entry.inputs;
})();

export type InspectionStatus = "ACTIVE" | "INACTIVE" | "REVOKED" | "FAILED" | "UNKNOWN";

function contractStrategy(strategy: StrategyV1) {
  return {
    maker: strategy.maker,
    agent: strategy.agent,
    ensRegistry: strategy.ensRegistry,
    ensResolver: strategy.ensResolver,
    ensLabel: strategy.ensLabel,
    ensNode: strategy.ensNode,
    tokenIn: strategy.tokenIn,
    tokenOut: strategy.tokenOut,
    swapTarget: strategy.swapTarget,
    swapSelector: strategy.swapSelector,
    minRateNumerator: BigInt(strategy.minRateNumerator),
    minRateDenominator: BigInt(strategy.minRateDenominator),
    maxInputPerCall: BigInt(strategy.maxInputPerCall),
    maxInputTotal: BigInt(strategy.maxInputTotal),
    validAfter: BigInt(strategy.validAfter),
    validUntil: BigInt(strategy.validUntil),
    salt: strategy.salt,
  };
}

export function encodeStrategy(strategy: StrategyV1): Hex {
  return encodeAbiParameters(strategyHashInputs, [
    contractStrategy(StrategyV1Schema.parse(strategy)),
  ]);
}

export function strategyHash(strategy: StrategyV1): Hex {
  return keccak256(encodeStrategy(strategy));
}

export function buildExecutionIntent(input: SimulationRequestV1): {
  request: SimulationRequestV1;
  strategyHash: Hex;
  calldata: Hex;
  calldataHash: Hex;
} {
  const request = SimulationRequestV1Schema.parse(input);
  const calldata = encodeFunctionData({
    abi: mandateAquaAppAbi,
    functionName: "execute",
    args: [
      contractStrategy(request.strategy),
      BigInt(request.amountIn),
      BigInt(request.agentMinOut),
      BigInt(request.executionDeadline),
      request.routeData,
    ],
  });
  return {
    request,
    strategyHash: strategyHash(request.strategy),
    calldata,
    calldataHash: keccak256(calldata),
  };
}

export function isSimulationCurrent(
  binding: SimulationBindingV1,
  request: SimulationRequestV1,
): boolean {
  const intent = buildExecutionIntent(request);
  return (
    binding.chainId === intent.request.chainId &&
    binding.caller === intent.request.strategy.agent &&
    binding.to === intent.request.mandateApp &&
    binding.strategyHash === intent.strategyHash &&
    binding.calldataHash === intent.calldataHash
  );
}

export function isIssuedAuthority(
  snapshot: MandateSnapshotV1,
  expectedStrategyHash: string,
): boolean {
  const exactSnapshot = MandateSnapshotV1Schema.parse(snapshot);
  return (
    exactSnapshot.strategyHash === expectedStrategyHash.toLowerCase() &&
    exactSnapshot.state.activated &&
    !exactSnapshot.state.revoked &&
    exactSnapshot.result === "PASS"
  );
}

export function remainingInput(snapshot: MandateSnapshotV1): string {
  const exactSnapshot = MandateSnapshotV1Schema.parse(snapshot);
  const remaining =
    BigInt(exactSnapshot.strategy.maxInputTotal) - BigInt(exactSnapshot.state.usedInput);
  return (remaining > 0n ? remaining : 0n).toString();
}

export function inspectionStatus(snapshot: MandateSnapshotV1): InspectionStatus {
  const exactSnapshot = MandateSnapshotV1Schema.parse(snapshot);
  if (exactSnapshot.result === "UNKNOWN") return "UNKNOWN";
  if (exactSnapshot.state.revoked) return "REVOKED";
  if (!exactSnapshot.state.activated) return "INACTIVE";
  return exactSnapshot.result === "PASS" ? "ACTIVE" : "FAILED";
}
