import { decodeFunctionData, encodeErrorResult, toFunctionSelector } from "viem";
import { describe, expect, it } from "vitest";
import { mandateAquaAppAbi } from "@mandate/contracts/mandate-aqua-app";

import {
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
