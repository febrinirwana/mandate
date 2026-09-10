import { buildExecutionCall } from "@mandate/chain";
import { encodeFunctionData, parseAbi } from "viem";
import type {
  MandateSnapshotV1,
  SimulationRequestV1,
  SimulationV1,
  StrategyV1,
} from "@mandate/domain";

const address = (digit: string): `0x${string}` => `0x${digit.repeat(40)}`;
const hash = (digit: string): `0x${string}` => `0x${digit.repeat(64)}`;
const venueAbi = parseAbi(["function swap(uint256 amountIn,uint256 amountOut,address recipient)"]);

export const now = new Date("2030-01-01T00:00:00.000Z");
export const strategy: StrategyV1 = {
  version: 1,
  maker: address("1"),
  agent: address("2"),
  ensRegistry: address("3"),
  ensResolver: address("4"),
  ensLabel: "agent",
  ensNode: hash("5"),
  tokenIn: address("6"),
  tokenOut: address("7"),
  swapTarget: address("8"),
  swapSelector: "0x12345678",
  minRateNumerator: "1",
  minRateDenominator: "1",
  maxInputPerCall: "100",
  maxInputTotal: "500",
  validAfter: "1893455900",
  validUntil: "1893457000",
  salt: hash("9"),
};

export const request: SimulationRequestV1 = {
  chainId: "11155111",
  routeData: encodeFunctionData({
    abi: venueAbi,
    functionName: "swap",
    args: [50n, 50n, address("a")],
  }),
  mandateApp: address("a"),
  strategy,
  amountIn: "50",
  agentMinOut: "50",
  executionDeadline: "1893456050",
};

const built = buildExecutionCall(request);
export const simulation: SimulationV1 = {
  version: 1,
  id: hash("b"),
  result: "PASS",
  reasons: [],
  binding: {
    chainId: request.chainId,
    blockNumber: "100",
    blockHash: hash("c"),
    caller: strategy.agent,
    to: request.mandateApp,
    calldataHash: built.calldataHash,
    strategyHash: built.strategyHash,
    expiresAt: "2030-01-01T00:00:30.000Z",
  },
  checks: [],
  expectedMovement: {
    makerTokenInDelta: "-50",
    makerTokenOutMinimumDelta: "50",
    agentTokenDelta: "0",
  },
};

export const snapshot: MandateSnapshotV1 = {
  version: 1,
  chainId: request.chainId,
  strategyHash: built.strategyHash,
  strategy,
  aqua: { address: address("d"), result: "PASS", inputBalance: "500", outputBalance: "0" },
  physical: {
    result: "PASS",
    makerTokenIn: "500",
    makerTokenOut: "0",
    agentTokenIn: "0",
    agentTokenOut: "0",
    appTokenIn: "0",
    appTokenOut: "0",
  },
  block: { number: "101", hash: hash("d") },
  state: { maker: strategy.maker, usedInput: "25", activated: true, revoked: false },
  ens: {
    status: "REGISTERED",
    tokenId: "1",
    owner: strategy.agent,
    expiry: "1893457001",
    address: strategy.agent,
  },
  result: "PASS",
};

export const policy = {
  chainId: request.chainId,
  mandateApp: request.mandateApp,
  signer: strategy.agent,
  strategyHash: built.strategyHash,
  tokenIn: strategy.tokenIn,
  tokenOut: strategy.tokenOut,
  routeTarget: strategy.swapTarget,
  routeSelector: strategy.swapSelector,
  routeRecipient: request.mandateApp,
  maxInputPerCall: strategy.maxInputPerCall,
  maxInputTotal: strategy.maxInputTotal,
} as const;

export function authority(overrides: Partial<MandateSnapshotV1> = {}) {
  const currentSnapshot = { ...snapshot, ...overrides };
  return {
    readMandate: () => Promise.resolve(currentSnapshot),
    simulate: () => Promise.resolve(simulation),
    getBlockHash: () => Promise.resolve(simulation.binding.blockHash),
    readExecution: () => Promise.reject(new Error("not used")),
    auditReceipt: () => Promise.reject(new Error("not used")),
  };
}
