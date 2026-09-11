import {
  assertSimulationRequestMatches,
  buildExecutionCall,
  type MandateChainService,
} from "@mandate/chain";
import {
  SimulationRequestV1Schema,
  SimulationV1Schema,
  StrategyV1Schema,
  type MandateSnapshotV1,
  type ReasonCode,
  type SimulationRequestV1,
  type SimulationV1,
  type StrategyV1,
} from "@mandate/domain";
import { decodeFunctionData, parseAbi, type Address, type Hex } from "viem";
import { z } from "zod";

const venueAbi = parseAbi(["function swap(uint256 amountIn,uint256 amountOut,address recipient)"]);

const ExecutionIntentSchema = z.strictObject({
  chainId: z.string().regex(/^[1-9][0-9]*$/),
  strategy: StrategyV1Schema,
  amountIn: z.string().regex(/^[1-9][0-9]*$/),
  agentMinOut: z.string().regex(/^(?:0|[1-9][0-9]*)$/),
  executionDeadline: z.string().regex(/^(?:0|[1-9][0-9]*)$/),
  routeData: z.string().regex(/^0x(?:[0-9a-f]{2})+$/) as z.ZodType<Hex>,
  simulation: SimulationV1Schema,
});

export type ExecutionIntent = z.infer<typeof ExecutionIntentSchema>;

export interface AgentPolicy {
  chainId: string;
  mandateApp: Address;
  signer: Address;
  strategyHash: Hex;
  tokenIn: Address;
  tokenOut: Address;
  routeTarget: Address;
  routeSelector: Hex;
  routeRecipient: Address;
  maxInputPerCall: string;
  maxInputTotal: string;
}

export interface AgentAuthority {
  readMandate(input: { chainId: string; strategyHash: Hex }): Promise<MandateSnapshotV1>;
  simulate(input: SimulationRequestV1): Promise<SimulationV1>;
  getBlockHash(chainId: string, blockNumber: bigint): Promise<Hex | null>;
  readExecution: MandateChainService["readExecution"];
  auditReceipt: MandateChainService["auditReceipt"];
}

export class AgentRejection extends Error {
  constructor(readonly reason: ReasonCode) {
    super(`Mandate execution rejected: ${reason}`);
  }
}

export interface ManualExecutionRequest {
  chainId: string;
  account: Address;
  to: Address;
  data: Hex;
  value: 0n;
}

type PreparedState = {
  intent: ExecutionIntent;
  request: ManualExecutionRequest;
  simulation: SimulationV1;
  authority: AgentAuthority;
  now: () => Date;
};

const preparedState = new WeakMap<PreparedExecution, PreparedState>();

export class PreparedExecution {
  readonly kind = "MANDATE_EXECUTE_PREPARED" as const;

  toManualRequest(): ManualExecutionRequest {
    return { ...stateOf(this).request };
  }
}

function makePrepared(state: PreparedState): PreparedExecution {
  const prepared = new PreparedExecution();
  preparedState.set(prepared, state);
  return prepared;
}

function stateOf(prepared: PreparedExecution): PreparedState {
  const state = preparedState.get(prepared);
  if (!state) throw new AgentRejection("INVALID_STRATEGY");
  return state;
}

function reject(reason: ReasonCode): never {
  throw new AgentRejection(reason);
}

function sameStrategy(left: StrategyV1, right: StrategyV1): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function checkSnapshot(
  snapshot: MandateSnapshotV1,
  intent: ExecutionIntent,
  policy: AgentPolicy,
): void {
  if (snapshot.chainId !== policy.chainId) reject("TARGET_MISMATCH");
  if (
    snapshot.strategyHash !== policy.strategyHash ||
    !sameStrategy(snapshot.strategy, intent.strategy)
  ) {
    reject("STRATEGY_HASH_MISMATCH");
  }
  if (!snapshot.state.activated) reject("MANDATE_INACTIVE");
  if (snapshot.state.revoked) reject("MANDATE_REVOKED");
  if (snapshot.result === "UNKNOWN") reject("ENS_READ_UNAVAILABLE");
  if (snapshot.ens.status === "UNAVAILABLE") reject("ENS_READ_UNAVAILABLE");
  if (snapshot.ens.status !== "REGISTERED") reject("ENS_NOT_REGISTERED");
  if (snapshot.ens.owner !== policy.signer) reject("ENS_OWNER_MISMATCH");
  if (snapshot.ens.address !== policy.signer) reject("ENS_ADDRESS_MISMATCH");
  if (snapshot.aqua.result !== "PASS") reject("AQUA_READ_UNAVAILABLE");
  if (BigInt(snapshot.aqua.inputBalance) < BigInt(intent.amountIn)) {
    reject("AQUA_BALANCE_INSUFFICIENT");
  }
  if (BigInt(snapshot.state.usedInput) + BigInt(intent.amountIn) > BigInt(policy.maxInputTotal)) {
    reject("TOTAL_CAP_EXCEEDED");
  }
}

function checkPolicy(intent: ExecutionIntent, policy: AgentPolicy, now: Date): SimulationRequestV1 {
  if (intent.chainId !== policy.chainId) reject("TARGET_MISMATCH");
  if (intent.strategy.agent !== policy.signer) reject("CALLER_NOT_AGENT");
  if (intent.strategy.swapTarget !== policy.routeTarget) reject("TARGET_MISMATCH");
  if (intent.strategy.swapSelector !== policy.routeSelector) reject("SELECTOR_MISMATCH");
  if (intent.strategy.tokenIn !== policy.tokenIn || intent.strategy.tokenOut !== policy.tokenOut) {
    reject("STRATEGY_HASH_MISMATCH");
  }
  const amount = BigInt(intent.amountIn);
  if (amount > BigInt(policy.maxInputPerCall) || amount > BigInt(intent.strategy.maxInputPerCall)) {
    reject("PER_CALL_CAP_EXCEEDED");
  }
  if (BigInt(intent.strategy.maxInputTotal) > BigInt(policy.maxInputTotal)) {
    reject("TOTAL_CAP_EXCEEDED");
  }
  const timestamp = BigInt(Math.floor(now.getTime() / 1_000));
  if (timestamp < BigInt(intent.strategy.validAfter)) reject("MANDATE_NOT_STARTED");
  if (timestamp >= BigInt(intent.strategy.validUntil)) reject("MANDATE_EXPIRED");
  const deadline = BigInt(intent.executionDeadline);
  if (deadline <= timestamp || deadline >= BigInt(intent.strategy.validUntil)) {
    reject("EXECUTION_DEADLINE_EXPIRED");
  }
  try {
    const route = decodeFunctionData({ abi: venueAbi, data: intent.routeData });
    if (route.functionName !== "swap") reject("SELECTOR_MISMATCH");
    const [routeAmount, routeMinimum, recipient] = route.args;
    if (routeAmount !== amount || routeMinimum < BigInt(intent.agentMinOut))
      reject("ROUTE_REVERTED");
    if (recipient.toLowerCase() !== policy.routeRecipient) reject("TARGET_MISMATCH");
  } catch (error) {
    if (error instanceof AgentRejection) throw error;
    reject(
      intent.routeData.slice(0, 10) === policy.routeSelector
        ? "ROUTE_REVERTED"
        : "SELECTOR_MISMATCH",
    );
  }
  return SimulationRequestV1Schema.parse({
    chainId: policy.chainId,
    mandateApp: policy.mandateApp,
    strategy: intent.strategy,
    amountIn: intent.amountIn,
    agentMinOut: intent.agentMinOut,
    executionDeadline: intent.executionDeadline,
    routeData: intent.routeData,
  });
}

async function checkSimulation(
  intent: ExecutionIntent,
  request: SimulationRequestV1,
  authority: AgentAuthority,
  now: Date,
): Promise<SimulationV1> {
  if (intent.simulation.binding.to !== request.mandateApp) reject("TARGET_MISMATCH");
  if (intent.simulation.result !== "PASS") {
    reject(intent.simulation.reasons[0] ?? "SIMULATION_STALE");
  }
  try {
    assertSimulationRequestMatches(intent.simulation.binding, request);
  } catch {
    reject("SIMULATION_STALE");
  }
  if (now.getTime() >= new Date(intent.simulation.binding.expiresAt).getTime()) {
    reject("SIMULATION_STALE");
  }
  let refreshed: SimulationV1;
  try {
    refreshed = await authority.simulate({
      ...request,
      blockNumber: intent.simulation.binding.blockNumber,
      previous: { id: intent.simulation.id, binding: intent.simulation.binding },
    });
  } catch {
    reject("ENS_READ_UNAVAILABLE");
  }
  if (
    refreshed.result !== "PASS" ||
    refreshed.id !== intent.simulation.id ||
    JSON.stringify(refreshed.binding) !== JSON.stringify(intent.simulation.binding)
  ) {
    reject(refreshed.reasons[0] ?? "SIMULATION_STALE");
  }
  let canonical: Hex | null;
  try {
    canonical = await authority.getBlockHash(
      request.chainId,
      BigInt(refreshed.binding.blockNumber),
    );
  } catch {
    reject("ENS_READ_UNAVAILABLE");
  }
  if (canonical !== refreshed.binding.blockHash) reject("SIMULATION_STALE");
  return refreshed;
}

export async function prepareExecution(
  rawIntent: ExecutionIntent,
  policy: AgentPolicy,
  authority: AgentAuthority,
  options: { now?: () => Date } = {},
): Promise<PreparedExecution> {
  const parsed = ExecutionIntentSchema.safeParse(rawIntent);
  if (!parsed.success) reject("INVALID_STRATEGY");
  const intent = parsed.data;
  const now = options.now ?? (() => new Date());
  const request = checkPolicy(intent, policy, now());
  const built = buildExecutionCall(request);
  if (built.strategyHash !== policy.strategyHash) reject("STRATEGY_HASH_MISMATCH");

  let snapshot: MandateSnapshotV1;
  try {
    snapshot = await authority.readMandate({
      chainId: policy.chainId,
      strategyHash: built.strategyHash,
    });
  } catch {
    reject("ENS_READ_UNAVAILABLE");
  }
  checkSnapshot(snapshot, intent, policy);
  const refreshed = await checkSimulation(intent, request, authority, now());
  return makePrepared({
    intent,
    request: {
      chainId: policy.chainId,
      account: policy.signer,
      to: policy.mandateApp,
      data: built.calldata,
      value: 0n,
    },
    simulation: refreshed,
    authority,
    now,
  });
}

export async function revalidatePrepared(
  prepared: PreparedExecution,
): Promise<ManualExecutionRequest> {
  const state = stateOf(prepared);
  if (state.now().getTime() >= new Date(state.simulation.binding.expiresAt).getTime()) {
    reject("SIMULATION_STALE");
  }
  let canonical: Hex | null;
  try {
    canonical = await state.authority.getBlockHash(
      state.request.chainId,
      BigInt(state.simulation.binding.blockNumber),
    );
  } catch {
    reject("ENS_READ_UNAVAILABLE");
  }
  if (canonical !== state.simulation.binding.blockHash) reject("SIMULATION_STALE");
  return { ...state.request };
}

export async function reprepareForSigner(
  prepared: PreparedExecution,
  policy: AgentPolicy,
  authority: AgentAuthority,
  options: { now?: () => Date } = {},
): Promise<ManualExecutionRequest> {
  const state = stateOf(prepared);
  const verified = await prepareExecution(state.intent, policy, authority, options);
  return revalidatePrepared(verified);
}
