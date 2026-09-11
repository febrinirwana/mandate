import {
  decodeFunctionData,
  encodeErrorResult,
  toFunctionSelector,
  type PublicClient,
} from "viem";
import { describe, expect, it, vi } from "vitest";
import { mandateAquaAppAbi } from "@mandate/contracts/mandate-aqua-app";

import {
  MandateChainService,
  StaleSimulationError,
  decodeStrategyBytes,
  assertSimulationRequestMatches,
  buildExecutionCall,
  mapMandateRevertData,
} from "../src/mandate.js";

const address = (digit: string) => `0x${digit.repeat(40)}` as const;
const hash = (digit: string) => `0x${digit.repeat(64)}` as const;
const request = {
  chainId: "11155111",
  mandateApp: address("1"),
  strategy: {
    version: 1 as const,
    maker: address("2"),
    agent: address("3"),
    ensRegistry: address("4"),
    ensResolver: address("5"),
    ensLabel: "agent",
    ensNode: hash("6"),
    tokenIn: address("7"),
    tokenOut: address("8"),
    swapTarget: address("9"),
    swapSelector: "0x12345678" as const,
    minRateNumerator: "2",
    minRateDenominator: "3",
    maxInputPerCall: "100",
    maxInputTotal: "500",
    validAfter: "1000",
    validUntil: "2000",
    salt: hash("a"),
  },
  amountIn: "100",
  agentMinOut: "67",
  executionDeadline: "1600",
  routeData: "0x12345678abcd" as const,
};

describe("buildExecutionCall", () => {
  it("binds exact execute calldata and strategy hash", () => {
    const built = buildExecutionCall(request);
    const decoded = decodeFunctionData({ abi: mandateAquaAppAbi, data: built.calldata });

    expect(decoded.functionName).toBe("execute");
    expect(decoded.args?.[1]).toBe(100n);
    expect(decoded.args?.[4]).toBe(request.routeData);
    expect(built.calldataHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(built.strategyHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(decodeStrategyBytes(built.strategyBytes)).toEqual(request.strategy);
  });
});

describe("MandateChainService", () => {
  it("loads an activation across the configured deployment range in one filtered query", async () => {
    const strategyBytes = buildExecutionCall(request).strategyBytes;
    const getLogs = vi.fn().mockResolvedValue([{ args: { strategy: strategyBytes } }]);
    const readContract = vi.fn().mockImplementation(({ functionName }: { functionName: string }) => {
      switch (functionName) {
        case "mandates":
          return [request.strategy.maker, 0n, true, false];
        case "getState":
          return { status: 2, expiry: 3_000n, latestOwner: request.strategy.agent, tokenId: 1n };
        case "getResolver":
          return request.strategy.ensResolver;
        case "ownerOf":
        case "addr":
          return request.strategy.agent;
        case "AQUA":
          return address("b");
        case "safeBalances":
          return [500n, 0n];
        case "balanceOf":
          return 0n;
        default:
          throw new Error(`unexpected read ${functionName}`);
      }
    });
    const client = {
      getBlockNumber: vi.fn().mockResolvedValue(2_000n),
      getLogs,
      getBlock: vi
        .fn()
        .mockResolvedValue({ number: 2_000n, hash: hash("b"), timestamp: 1_500n }),
      readContract,
    } as unknown as PublicClient;
    const service = new MandateChainService([
      { chainId: request.chainId, client, mandateApp: request.mandateApp, deploymentBlock: 1_000n },
    ]);

    const snapshot = await service.readMandate({
      chainId: request.chainId,
      strategyHash: buildExecutionCall(request).strategyHash,
    });

    expect(snapshot.strategy).toEqual(request.strategy);
    expect(snapshot.result).toBe("PASS");
    expect(getLogs).toHaveBeenCalledOnce();
    expect(getLogs).toHaveBeenCalledWith(
      expect.objectContaining({ fromBlock: 1_000n, toBlock: 2_000n }),
    );
  });
});

describe("assertSimulationRequestMatches", () => {
  it("rejects changed execution input against an old binding", () => {
    const built = buildExecutionCall(request);
    const binding = {
      chainId: request.chainId,
      blockNumber: "100",
      blockHash: hash("b"),
      caller: request.strategy.agent,
      to: request.mandateApp,
      calldataHash: built.calldataHash,
      strategyHash: built.strategyHash,
      expiresAt: "2026-09-07T12:00:00.000Z",
    } as const;

    expect(() => assertSimulationRequestMatches(binding, request)).not.toThrow();
    expect(() => assertSimulationRequestMatches(binding, { ...request, amountIn: "99" })).toThrow(
      StaleSimulationError,
    );
  });
});

describe("mapMandateRevertData", () => {
  it.each([
    ["AlreadyActivated", "ALREADY_ACTIVATED"],
    ["AquaBalanceInsufficient", "AQUA_BALANCE_INSUFFICIENT"],
    ["AquaStrategyInactive", "AQUA_STRATEGY_INACTIVE"],
    ["ENSAddressMismatch", "ENS_ADDRESS_MISMATCH"],
    ["ENSExpired", "ENS_EXPIRED"],
    ["ENSNotRegistered", "ENS_NOT_REGISTERED"],
    ["ENSOwnerMismatch", "ENS_OWNER_MISMATCH"],
    ["ExecutionDeadlineExpired", "EXECUTION_DEADLINE_EXPIRED"],
    ["Expired", "MANDATE_EXPIRED"],
    ["InputNotFullySpent", "INPUT_NOT_FULLY_SPENT"],
    ["InputTransferMismatch", "INPUT_TRANSFER_MISMATCH"],
    ["InvalidStrategy", "INVALID_STRATEGY"],
    ["MandateInactive", "MANDATE_INACTIVE"],
    ["MandateRevokedError", "MANDATE_REVOKED"],
    ["NotAgent", "CALLER_NOT_AGENT"],
    ["NotMaker", "MAKER_NOT_CALLER"],
    ["NotStarted", "MANDATE_NOT_STARTED"],
    ["OutputTooLow", "OUTPUT_TOO_LOW"],
    ["PerCallCapExceeded", "PER_CALL_CAP_EXCEEDED"],
    ["ReentrantCall", "REENTRANT_CALL"],
    ["ResidualAllowance", "ALLOWANCE_NOT_CLEARED"],
    ["ResidualBalance", "RESIDUAL_BALANCE"],
    ["TotalCapExceeded", "TOTAL_CAP_EXCEEDED"],
    ["WrongSelector", "SELECTOR_MISMATCH"],
    ["ZeroAmount", "INVALID_AMOUNT"],
  ])("maps %s to %s", (errorName, reason) => {
    expect(mapMandateRevertData(toFunctionSelector(`${errorName}()`))).toBe(reason);
  });

  it("maps argument-bearing errors and keeps unknown reverts unknown", () => {
    expect(
      mapMandateRevertData(
        encodeErrorResult({
          abi: mandateAquaAppAbi,
          errorName: "RouteCallFailed",
          args: ["0x12345678", hash("b")],
        }),
      ),
    ).toBe("ROUTE_CALL_FAILED");
    expect(
      mapMandateRevertData(
        encodeErrorResult({
          abi: mandateAquaAppAbi,
          errorName: "SafeERC20FailedOperation",
          args: [address("c")],
        }),
      ),
    ).toBe("TOKEN_OPERATION_FAILED");
    expect(mapMandateRevertData("0xdeadbeef")).toBe("ROUTE_REVERTED");
    expect(mapMandateRevertData(undefined)).toBe("ROUTE_REVERTED");
  });
});
