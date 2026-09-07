import { mandateAquaAppAbi } from "@mandate/contracts/mandate-aqua-app";
import {
  ReceiptAuditV1Schema,
  SimulationV1Schema,
  StrategyV1Schema,
  type CheckV1,
  type ExecutionV1,
  type MandateSnapshotV1,
  type ReasonCode,
  type ReceiptAuditV1,
  type SimulationBindingV1,
  type SimulationRequestV1,
  type SimulationV1,
  type StrategyV1,
} from "@mandate/domain";
import { evaluatePreflight } from "@mandate/policy";
import {
  decodeAbiParameters,
  decodeFunctionData,
  decodeErrorResult,
  encodeAbiParameters,
  encodeFunctionData,
  keccak256,
  parseAbi,
  parseAbiItem,
  parseEventLogs,
  stringToHex,
  type Address,
  type Hex,
  type PublicClient,
  zeroAddress,
} from "viem";

import { addrResolverAbi, permissionedRegistryAbi } from "./ens.js";

const strategyParameters = [
  {
    name: "strategy",
    type: "tuple",
    components: [
      { name: "maker", type: "address" },
      { name: "agent", type: "address" },
      { name: "ensRegistry", type: "address" },
      { name: "ensResolver", type: "address" },
      { name: "ensLabel", type: "string" },
      { name: "ensNode", type: "bytes32" },
      { name: "tokenIn", type: "address" },
      { name: "tokenOut", type: "address" },
      { name: "swapTarget", type: "address" },
      { name: "swapSelector", type: "bytes4" },
      { name: "minRateNumerator", type: "uint256" },
      { name: "minRateDenominator", type: "uint256" },
      { name: "maxInputPerCall", type: "uint256" },
      { name: "maxInputTotal", type: "uint256" },
      { name: "validAfter", type: "uint64" },
      { name: "validUntil", type: "uint64" },
      { name: "salt", type: "bytes32" },
    ],
  },
] as const;

const aquaAbi = parseAbi([
  "function safeBalances(address maker,address app,bytes32 strategyHash,address token0,address token1) view returns (uint256 balance0,uint256 balance1)",
  "function rawBalances(address maker,address app,bytes32 strategyHash,address token) view returns (uint248 balance,uint8 tokensCount)",
]);
const erc20Abi = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner,address spender) view returns (uint256)",
]);
const activatedEvent = parseAbiItem(
  "event MandateActivated(bytes32 indexed strategyHash,address indexed maker,address indexed agent,bytes strategy)",
);

function toContractStrategy(strategy: StrategyV1) {
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

export interface BuiltExecutionCall {
  strategyHash: Hex;
  strategyBytes: Hex;
  calldata: Hex;
  calldataHash: Hex;
}

export function buildExecutionCall(
  request: Pick<
    SimulationRequestV1,
    "strategy" | "amountIn" | "agentMinOut" | "executionDeadline" | "routeData"
  >,
): BuiltExecutionCall {
  const strategy = toContractStrategy(request.strategy);
  const strategyBytes = encodeAbiParameters(strategyParameters, [strategy]);
  const calldata = encodeFunctionData({
    abi: mandateAquaAppAbi,
    functionName: "execute",
    args: [
      strategy,
      BigInt(request.amountIn),
      BigInt(request.agentMinOut),
      BigInt(request.executionDeadline),
      request.routeData,
    ],
  });
  return {
    strategyHash: keccak256(strategyBytes),
    strategyBytes,
    calldata,
    calldataHash: keccak256(calldata),
  };
}

const revertReasons: Readonly<Record<string, ReasonCode>> = {
  AlreadyActivated: "ALREADY_ACTIVATED",
  AquaBalanceInsufficient: "AQUA_BALANCE_INSUFFICIENT",
  AquaStrategyInactive: "AQUA_STRATEGY_INACTIVE",
  ENSAddressMismatch: "ENS_ADDRESS_MISMATCH",
  ENSExpired: "ENS_EXPIRED",
  ENSNotRegistered: "ENS_NOT_REGISTERED",
  ENSOwnerMismatch: "ENS_OWNER_MISMATCH",
  ExecutionDeadlineExpired: "EXECUTION_DEADLINE_EXPIRED",
  Expired: "MANDATE_EXPIRED",
  InputNotFullySpent: "INPUT_NOT_FULLY_SPENT",
  InputTransferMismatch: "INPUT_TRANSFER_MISMATCH",
  InvalidStrategy: "INVALID_STRATEGY",
  MandateInactive: "MANDATE_INACTIVE",
  MandateRevokedError: "MANDATE_REVOKED",
  NotAgent: "CALLER_NOT_AGENT",
  NotMaker: "MAKER_NOT_CALLER",
  NotStarted: "MANDATE_NOT_STARTED",
  OutputTooLow: "OUTPUT_TOO_LOW",
  PerCallCapExceeded: "PER_CALL_CAP_EXCEEDED",
  ReentrantCall: "REENTRANT_CALL",
  ResidualAllowance: "ALLOWANCE_NOT_CLEARED",
  ResidualBalance: "RESIDUAL_BALANCE",
  RouteCallFailed: "ROUTE_CALL_FAILED",
  SafeERC20FailedOperation: "TOKEN_OPERATION_FAILED",
  TotalCapExceeded: "TOTAL_CAP_EXCEEDED",
  WrongSelector: "SELECTOR_MISMATCH",
  ZeroAmount: "INVALID_AMOUNT",
};

export function mapMandateRevertData(data: Hex | undefined): ReasonCode {
  if (!data) return "ROUTE_REVERTED";
  try {
    const decoded = decodeErrorResult({ abi: mandateAquaAppAbi, data });
    return revertReasons[decoded.errorName] ?? "ROUTE_REVERTED";
  } catch {
    return "ROUTE_REVERTED";
  }
}

function findRevertData(error: unknown): Hex | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 6 && current && typeof current === "object"; depth += 1) {
    const record = current as Record<string, unknown>;
    if (typeof record["data"] === "string" && /^0x[0-9a-f]+$/i.test(record["data"])) {
      return record["data"] as Hex;
    }
    current = record["cause"];
  }
  return undefined;
}

export class StaleSimulationError extends Error {
  constructor() {
    super("simulation binding is stale");
  }
}

export class ChainReadError extends Error {
  constructor(
    readonly kind: "NOT_FOUND" | "UNAVAILABLE",
    message: string,
  ) {
    super(message);
  }
}

export function assertSimulationRequestMatches(
  binding: SimulationBindingV1,
  request: SimulationRequestV1,
): void {
  const built = buildExecutionCall(request);
  if (
    binding.chainId !== request.chainId ||
    binding.caller !== request.strategy.agent ||
    binding.to !== request.mandateApp ||
    binding.calldataHash !== built.calldataHash ||
    binding.strategyHash !== built.strategyHash
  ) {
    throw new StaleSimulationError();
  }
}

function hashBinding(binding: SimulationBindingV1): Hex {
  return keccak256(stringToHex(JSON.stringify(binding)));
}

function hashJson(value: unknown): Hex {
  return keccak256(
    stringToHex(
      JSON.stringify(value, (_key, item: unknown) =>
        typeof item === "bigint" ? item.toString() : item,
      ),
    ),
  );
}

interface ChainRuntime {
  chainId: string;
  client: PublicClient;
  mandateApp: Address;
  deploymentBlock?: bigint;
}

interface EnsObservation {
  available: true;
  status: string;
  tokenId: string;
  owner: Address;
  expiry: string;
  resolver: Address;
  address: Address;
}

interface AquaObservation {
  available: true;
  active: boolean;
  inputBalance: string;
  outputBalance: string;
  address: Address;
}

function normalizeAddress(address: Address): Address {
  return address.toLowerCase() as Address;
}

async function readEns(
  client: PublicClient,
  strategy: StrategyV1,
  blockNumber: bigint,
): Promise<EnsObservation | { available: false }> {
  try {
    const [state, resolver] = await Promise.all([
      client.readContract({
        address: strategy.ensRegistry,
        abi: permissionedRegistryAbi,
        functionName: "getState",
        args: [BigInt(keccak256(stringToHex(strategy.ensLabel)))],
        blockNumber,
      }),
      client.readContract({
        address: strategy.ensRegistry,
        abi: permissionedRegistryAbi,
        functionName: "getResolver",
        args: [strategy.ensLabel],
        blockNumber,
      }),
    ]);
    const status =
      Number(state.status) === 2
        ? "REGISTERED"
        : Number(state.status) === 1
          ? "RESERVED"
          : "AVAILABLE";
    if (status !== "REGISTERED") {
      return {
        available: true,
        status,
        tokenId: state.tokenId.toString(),
        owner: zeroAddress,
        expiry: state.expiry.toString(),
        resolver: normalizeAddress(resolver),
        address: zeroAddress,
      };
    }
    const [owner, resolved] = await Promise.all([
      client.readContract({
        address: strategy.ensRegistry,
        abi: permissionedRegistryAbi,
        functionName: "ownerOf",
        args: [state.tokenId],
        blockNumber,
      }),
      client.readContract({
        address: resolver,
        abi: addrResolverAbi,
        functionName: "addr",
        args: [strategy.ensNode],
        blockNumber,
      }),
    ]);
    return {
      available: true,
      status,
      tokenId: state.tokenId.toString(),
      owner: normalizeAddress(owner),
      expiry: state.expiry.toString(),
      resolver: normalizeAddress(resolver),
      address: normalizeAddress(resolved),
    };
  } catch {
    return { available: false };
  }
}

async function readAqua(
  client: PublicClient,
  mandateApp: Address,
  strategyHash: Hex,
  strategy: StrategyV1,
  blockNumber: bigint,
): Promise<AquaObservation | { available: false }> {
  try {
    const aqua = await client.readContract({
      address: mandateApp,
      abi: mandateAquaAppAbi,
      functionName: "AQUA",
      blockNumber,
    });
    const balances = await client.readContract({
      address: aqua,
      abi: aquaAbi,
      functionName: "safeBalances",
      args: [strategy.maker, mandateApp, strategyHash, strategy.tokenIn, strategy.tokenOut],
      blockNumber,
    });
    return {
      available: true,
      active: true,
      inputBalance: balances[0].toString(),
      outputBalance: balances[1].toString(),
      address: aqua,
    };
  } catch {
    return { available: false };
  }
}

export function decodeStrategyBytes(bytes: Hex): StrategyV1 {
  const decoded = decodeAbiParameters(strategyParameters, bytes)[0];
  return StrategyV1Schema.parse({
    version: 1,
    ...decoded,
    maker: normalizeAddress(decoded.maker),
    agent: normalizeAddress(decoded.agent),
    ensRegistry: normalizeAddress(decoded.ensRegistry),
    ensResolver: normalizeAddress(decoded.ensResolver),
    tokenIn: normalizeAddress(decoded.tokenIn),
    tokenOut: normalizeAddress(decoded.tokenOut),
    swapTarget: normalizeAddress(decoded.swapTarget),
    minRateNumerator: decoded.minRateNumerator.toString(),
    minRateDenominator: decoded.minRateDenominator.toString(),
    maxInputPerCall: decoded.maxInputPerCall.toString(),
    maxInputTotal: decoded.maxInputTotal.toString(),
    validAfter: decoded.validAfter.toString(),
    validUntil: decoded.validUntil.toString(),
  });
}

function check(code: ReasonCode, result: "PASS" | "FAIL" | "UNKNOWN"): CheckV1 {
  return { code, result };
}

export class MandateChainService {
  private readonly runtimes = new Map<string, ChainRuntime>();

  constructor(runtimes: readonly ChainRuntime[]) {
    for (const runtime of runtimes) this.runtimes.set(runtime.chainId, runtime);
  }

  private runtime(chainId: string): ChainRuntime {
    const runtime = this.runtimes.get(chainId);
    if (!runtime) throw new ChainReadError("NOT_FOUND", `unsupported chain ${chainId}`);
    return runtime;
  }

  private async header(runtime: ChainRuntime, blockNumber?: string) {
    try {
      return blockNumber
        ? await runtime.client.getBlock({ blockNumber: BigInt(blockNumber) })
        : await runtime.client.getBlock();
    } catch {
      throw new ChainReadError("UNAVAILABLE", "chain block is unavailable");
    }
  }

  private async ensureCanonical(runtime: ChainRuntime, number: bigint, hash: Hex): Promise<void> {
    try {
      const canonical = await runtime.client.getBlock({ blockNumber: number });
      if (canonical.hash !== hash) throw new StaleSimulationError();
    } catch (error) {
      if (error instanceof StaleSimulationError) throw error;
      throw new ChainReadError("UNAVAILABLE", "canonical block read is unavailable");
    }
  }

  private async strategy(runtime: ChainRuntime, strategyHash: Hex): Promise<StrategyV1> {
    try {
      const latest = await runtime.client.getBlockNumber();
      const first = runtime.deploymentBlock ?? (latest > 9n ? latest - 9n : 0n);
      const last = first + 999n < latest ? first + 999n : latest;
      for (let fromBlock = first; fromBlock <= last; fromBlock += 10n) {
        const toBlock = fromBlock + 9n < last ? fromBlock + 9n : last;
        const logs = await runtime.client.getLogs({
          address: runtime.mandateApp,
          event: activatedEvent,
          args: { strategyHash },
          fromBlock,
          toBlock,
        });
        const activation = logs.at(-1);
        if (activation?.args.strategy) {
          return decodeStrategyBytes(activation.args.strategy);
        }
      }
      if (last < latest) {
        throw new ChainReadError(
          "UNAVAILABLE",
          "activation event is outside the bounded scan window",
        );
      }
      throw new ChainReadError("NOT_FOUND", "mandate not found");
    } catch (error) {
      if (error instanceof ChainReadError) throw error;
      throw new ChainReadError("UNAVAILABLE", "activation event read is unavailable");
    }
  }

  async readMandate(input: { chainId: string; strategyHash: Hex }): Promise<MandateSnapshotV1> {
    const runtime = this.runtime(input.chainId);
    const [header, strategy] = await Promise.all([
      this.header(runtime),
      this.strategy(runtime, input.strategyHash),
    ]);
    if (header.number === null || header.hash === null) {
      throw new ChainReadError("UNAVAILABLE", "chain block is unavailable");
    }
    const [state, ens] = await Promise.all([
      runtime.client.readContract({
        address: runtime.mandateApp,
        abi: mandateAquaAppAbi,
        functionName: "mandates",
        args: [input.strategyHash],
        blockNumber: header.number,
      }),
      readEns(runtime.client, strategy, header.number),
    ]);
    await this.ensureCanonical(runtime, header.number, header.hash);
    const identityValid =
      ens.available &&
      ens.status === "REGISTERED" &&
      BigInt(ens.expiry) > header.timestamp &&
      ens.owner === strategy.agent &&
      ens.resolver === strategy.ensResolver &&
      ens.address === strategy.agent;
    const result =
      !state[2] || state[3] ? "FAIL" : !ens.available ? "UNKNOWN" : identityValid ? "PASS" : "FAIL";
    return {
      version: 1,
      chainId: input.chainId,
      strategyHash: input.strategyHash,
      block: { number: header.number.toString(), hash: header.hash },
      state: {
        maker: normalizeAddress(state[0]),
        usedInput: state[1].toString(),
        activated: state[2],
        revoked: state[3],
      },
      ens: ens.available
        ? {
            status: ens.status,
            tokenId: ens.tokenId,
            owner: ens.owner,
            expiry: ens.expiry,
            address: ens.address,
          }
        : {
            status: "UNAVAILABLE",
            tokenId: "0",
            owner: zeroAddress,
            expiry: "0",
            address: zeroAddress,
          },
      result,
    };
  }

  async simulate(input: SimulationRequestV1): Promise<SimulationV1> {
    const runtime = this.runtime(input.chainId);
    if (runtime.mandateApp !== input.mandateApp) {
      throw new ChainReadError("NOT_FOUND", "mandate deployment mismatch");
    }
    if (input.previous) {
      assertSimulationRequestMatches(input.previous.binding, input);
      if (input.previous.id !== hashBinding(input.previous.binding)) {
        throw new StaleSimulationError();
      }
    }
    const header = await this.header(runtime, input.blockNumber);
    if (header.number === null || header.hash === null) {
      throw new ChainReadError("UNAVAILABLE", "simulation block is unavailable");
    }
    if (
      input.previous &&
      (input.previous.binding.blockNumber !== header.number.toString() ||
        input.previous.binding.blockHash !== header.hash)
    ) {
      throw new StaleSimulationError();
    }

    const built = buildExecutionCall(input);
    const [state, ens, aqua] = await Promise.all([
      runtime.client.readContract({
        address: runtime.mandateApp,
        abi: mandateAquaAppAbi,
        functionName: "mandates",
        args: [built.strategyHash],
        blockNumber: header.number,
      }),
      readEns(runtime.client, input.strategy, header.number),
      readAqua(
        runtime.client,
        runtime.mandateApp,
        built.strategyHash,
        input.strategy,
        header.number,
      ),
    ]);
    const evaluation = evaluatePreflight({
      strategy: input.strategy,
      mandate: {
        maker: state[0],
        usedInput: state[1].toString(),
        activated: state[2],
        revoked: state[3],
      },
      ens,
      aqua,
      request: {
        caller: input.strategy.agent,
        amountIn: input.amountIn,
        agentMinOut: input.agentMinOut,
        executionDeadline: input.executionDeadline,
        routeData: input.routeData,
      },
      blockTimestamp: header.timestamp.toString(),
    });

    let result = evaluation.result;
    let reasons = evaluation.reasons;
    let checks = evaluation.checks;
    if (result === "PASS") {
      try {
        await runtime.client.call({
          account: input.strategy.agent,
          to: runtime.mandateApp,
          data: built.calldata,
          blockNumber: header.number,
        });
      } catch (error) {
        const data = findRevertData(error);
        const reason = data ? mapMandateRevertData(data) : "ROUTE_REVERTED";
        const callResult = data ? "FAIL" : "UNKNOWN";
        result = callResult;
        reasons = [reason];
        checks = [...checks, check(reason, callResult)];
      }
    }
    await this.ensureCanonical(runtime, header.number, header.hash);

    const binding: SimulationBindingV1 = {
      chainId: input.chainId,
      blockNumber: header.number.toString(),
      blockHash: header.hash,
      caller: input.strategy.agent,
      to: runtime.mandateApp,
      calldataHash: built.calldataHash,
      strategyHash: built.strategyHash,
      expiresAt: new Date(Number(header.timestamp + 30n) * 1000).toISOString(),
    };
    return SimulationV1Schema.parse({
      version: 1,
      id: hashBinding(binding),
      result,
      reasons,
      binding,
      checks,
      expectedMovement: {
        makerTokenInDelta: `-${input.amountIn}`,
        makerTokenOutMinimumDelta: (BigInt(input.agentMinOut) > BigInt(evaluation.minimumOutput)
          ? BigInt(input.agentMinOut)
          : BigInt(evaluation.minimumOutput)
        ).toString(),
        agentTokenDelta: "0",
      },
    });
  }

  private async receipt(runtime: ChainRuntime, txHash: Hex) {
    try {
      return await runtime.client.getTransactionReceipt({ hash: txHash });
    } catch {
      throw new ChainReadError("NOT_FOUND", "execution receipt not found");
    }
  }

  private async executionEvent(runtime: ChainRuntime, txHash: Hex) {
    const receipt = await this.receipt(runtime, txHash);
    const events = parseEventLogs({
      abi: mandateAquaAppAbi,
      logs: receipt.logs,
      eventName: "MandateExecuted",
      strict: true,
    });
    const event = events.find(
      (candidate) => normalizeAddress(candidate.address) === runtime.mandateApp,
    );
    if (!event) throw new ChainReadError("NOT_FOUND", "MandateExecuted event not found");
    return { receipt, event };
  }

  async readExecution(input: { chainId: string; txHash: Hex }): Promise<ExecutionV1> {
    const runtime = this.runtime(input.chainId);
    const { receipt, event } = await this.executionEvent(runtime, input.txHash);
    const canonical = await runtime.client.getBlock({ blockNumber: receipt.blockNumber });
    const args = event.args;
    return {
      version: 1,
      chainId: input.chainId,
      txHash: input.txHash,
      block: { number: receipt.blockNumber.toString(), hash: receipt.blockHash },
      strategyHash: args.strategyHash,
      caller: normalizeAddress(args.agent),
      amountIn: args.amountIn.toString(),
      amountOut: args.amountOut.toString(),
      usedInputAfter: args.usedInputAfter.toString(),
      status: canonical.hash === receipt.blockHash ? "CONFIRMED" : "REORGED",
    };
  }

  async auditReceipt(input: { chainId: string; txHash: Hex }): Promise<ReceiptAuditV1> {
    const runtime = this.runtime(input.chainId);
    const receipt = await this.receipt(runtime, input.txHash);
    const events = parseEventLogs({
      abi: mandateAquaAppAbi,
      logs: receipt.logs,
      eventName: "MandateExecuted",
      strict: true,
    });
    const event = events.find(
      (candidate) => normalizeAddress(candidate.address) === runtime.mandateApp,
    );
    if (!event) {
      try {
        const transaction = await runtime.client.getTransaction({ hash: input.txHash });
        const decoded = decodeFunctionData({ abi: mandateAquaAppAbi, data: transaction.input });
        if (
          decoded.functionName !== "execute" ||
          !decoded.args ||
          transaction.to === null ||
          normalizeAddress(transaction.to) !== runtime.mandateApp
        ) {
          throw new Error("not a Mandate execution");
        }
        const strategyBytes = encodeAbiParameters(strategyParameters, [decoded.args[0]]);
        return ReceiptAuditV1Schema.parse({
          version: 1,
          result: "UNKNOWN",
          chainId: input.chainId,
          txHash: input.txHash,
          block: { number: receipt.blockNumber.toString(), hash: receipt.blockHash },
          strategyHash: keccak256(strategyBytes),
          checks: [check("EVENT_UNDECODABLE", "UNKNOWN")],
          evidence: [
            { provider: "rpc-receipt", responseHash: hashJson(receipt) },
            { provider: "rpc-transaction", responseHash: hashJson(transaction) },
          ],
        });
      } catch {
        throw new ChainReadError("UNAVAILABLE", "Mandate execution event is undecodable");
      }
    }
    const args = event.args;
    const strategy = await this.strategy(runtime, args.strategyHash);
    const checks: CheckV1[] = [];
    try {
      const canonical =
        (await runtime.client.getBlock({ blockNumber: receipt.blockNumber })).hash ===
        receipt.blockHash;
      checks.push(check("RECEIPT_NOT_CANONICAL", canonical ? "PASS" : "UNKNOWN"));
    } catch {
      checks.push(check("RECEIPT_NOT_CANONICAL", "UNKNOWN"));
    }

    const ens = await readEns(runtime.client, strategy, receipt.blockNumber);
    if (!ens.available) {
      checks.push(check("ENS_READ_UNAVAILABLE", "UNKNOWN"));
    } else {
      checks.push(
        check("ENS_NOT_REGISTERED", ens.status === "REGISTERED" ? "PASS" : "FAIL"),
        check(
          "ENS_EXPIRED",
          BigInt(ens.expiry) >
            (await runtime.client.getBlock({ blockHash: receipt.blockHash })).timestamp
            ? "PASS"
            : "FAIL",
        ),
        check("ENS_OWNER_MISMATCH", ens.owner === strategy.agent ? "PASS" : "FAIL"),
        check(
          "ENS_ADDRESS_MISMATCH",
          ens.resolver === strategy.ensResolver && ens.address === strategy.agent ? "PASS" : "FAIL",
        ),
      );
    }

    try {
      if (receipt.blockNumber === 0n) throw new Error("genesis has no prior state");
      const aqua = await runtime.client.readContract({
        address: runtime.mandateApp,
        abi: mandateAquaAppAbi,
        functionName: "AQUA",
        blockNumber: receipt.blockNumber,
      });
      const beforeBlock = receipt.blockNumber - 1n;
      const [
        appInBefore,
        appInAfter,
        appOutBefore,
        appOutAfter,
        allowanceAfter,
        aquaInBefore,
        aquaInAfter,
        aquaOutBefore,
        aquaOutAfter,
      ] = await Promise.all([
        runtime.client.readContract({
          address: strategy.tokenIn,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [runtime.mandateApp],
          blockNumber: beforeBlock,
        }),
        runtime.client.readContract({
          address: strategy.tokenIn,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [runtime.mandateApp],
          blockNumber: receipt.blockNumber,
        }),
        runtime.client.readContract({
          address: strategy.tokenOut,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [runtime.mandateApp],
          blockNumber: beforeBlock,
        }),
        runtime.client.readContract({
          address: strategy.tokenOut,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [runtime.mandateApp],
          blockNumber: receipt.blockNumber,
        }),
        runtime.client.readContract({
          address: strategy.tokenIn,
          abi: erc20Abi,
          functionName: "allowance",
          args: [runtime.mandateApp, strategy.swapTarget],
          blockNumber: receipt.blockNumber,
        }),
        runtime.client.readContract({
          address: aqua,
          abi: aquaAbi,
          functionName: "rawBalances",
          args: [strategy.maker, runtime.mandateApp, args.strategyHash, strategy.tokenIn],
          blockNumber: beforeBlock,
        }),
        runtime.client.readContract({
          address: aqua,
          abi: aquaAbi,
          functionName: "rawBalances",
          args: [strategy.maker, runtime.mandateApp, args.strategyHash, strategy.tokenIn],
          blockNumber: receipt.blockNumber,
        }),
        runtime.client.readContract({
          address: aqua,
          abi: aquaAbi,
          functionName: "rawBalances",
          args: [strategy.maker, runtime.mandateApp, args.strategyHash, strategy.tokenOut],
          blockNumber: beforeBlock,
        }),
        runtime.client.readContract({
          address: aqua,
          abi: aquaAbi,
          functionName: "rawBalances",
          args: [strategy.maker, runtime.mandateApp, args.strategyHash, strategy.tokenOut],
          blockNumber: receipt.blockNumber,
        }),
      ]);
      checks.push(
        check("INPUT_NOT_FULLY_SPENT", appInAfter === appInBefore ? "PASS" : "FAIL"),
        check("RESIDUAL_BALANCE", appOutAfter === appOutBefore ? "PASS" : "FAIL"),
        check("ALLOWANCE_NOT_CLEARED", allowanceAfter === 0n ? "PASS" : "FAIL"),
        check(
          "AQUA_BALANCE_INSUFFICIENT",
          aquaInBefore[0] - aquaInAfter[0] === args.amountIn ? "PASS" : "FAIL",
        ),
        check(
          "OUTPUT_TOO_LOW",
          aquaOutAfter[0] - aquaOutBefore[0] === args.amountOut ? "PASS" : "FAIL",
        ),
      );
    } catch {
      checks.push(
        check("INPUT_NOT_FULLY_SPENT", "UNKNOWN"),
        check("RESIDUAL_BALANCE", "UNKNOWN"),
        check("ALLOWANCE_NOT_CLEARED", "UNKNOWN"),
        check("AQUA_READ_UNAVAILABLE", "UNKNOWN"),
      );
    }

    const failed = checks.some((item) => item.result === "FAIL");
    const unknown = checks.some((item) => item.result === "UNKNOWN");
    return ReceiptAuditV1Schema.parse({
      version: 1,
      result: failed ? "NON_COMPLIANT" : unknown ? "UNKNOWN" : "COMPLIANT",
      chainId: input.chainId,
      txHash: input.txHash,
      block: { number: receipt.blockNumber.toString(), hash: receipt.blockHash },
      strategyHash: args.strategyHash,
      checks,
      evidence: [
        { provider: "rpc-receipt", responseHash: hashJson(receipt) },
        {
          provider: "mandate-strategy",
          responseHash: keccak256(
            encodeAbiParameters(strategyParameters, [toContractStrategy(strategy)]),
          ),
        },
      ],
    });
  }
}
