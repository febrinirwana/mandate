import { decodeFunctionData, parseAbi } from "viem";
import { describe, expect, it, vi } from "vitest";

import {
  buildOwnerControlCalls,
  canManageAuthority,
  submitOwnerControl,
} from "../src/components/mandate/owner-controls";

const address = (digit: string): `0x${string}` => `0x${digit.repeat(40)}`;
const hash = (digit: string): `0x${string}` => `0x${digit.repeat(64)}`;

const snapshot = {
  strategyHash: hash("1"),
  aqua: { address: address("2") },
  state: { usedInput: "250" },
  strategy: {
    maker: address("3"),
    tokenIn: address("4"),
    tokenOut: address("5"),
    maxInputTotal: "1000",
  },
};
const mandateApp = address("6");

describe("smart-account owner controls", () => {
  it("enables authority actions only for the mandate maker smart account", () => {
    expect(canManageAuthority(`0x${"3".repeat(40).toUpperCase()}`, snapshot.strategy.maker)).toBe(
      true,
    );
    expect(canManageAuthority(address("7"), snapshot.strategy.maker)).toBe(false);
    expect(canManageAuthority(undefined, snapshot.strategy.maker)).toBe(false);
  });

  it("builds a remaining-cap approval plus exact revoke and Aqua dock calldata", () => {
    const approval = buildOwnerControlCalls(snapshot, mandateApp, "RESTORE_APPROVAL");
    expect(approval).toHaveLength(1);
    expect(approval[0].to).toBe(snapshot.strategy.tokenIn);
    const approvalData = decodeFunctionData({
      abi: parseAbi(["function approve(address spender,uint256 amount) returns (bool)"]),
      data: approval[0].data!,
    });
    expect(approvalData.functionName).toBe("approve");
    expect(approvalData.args).toEqual([snapshot.aqua.address, 750n]);

    const revoke = buildOwnerControlCalls(snapshot, mandateApp, "REVOKE");
    expect(revoke).toHaveLength(1);
    expect(revoke[0].to).toBe(mandateApp);
    const revokeData = decodeFunctionData({
      abi: parseAbi(["function revoke(bytes32 hash)"]),
      data: revoke[0].data!,
    });
    expect(revokeData.functionName).toBe("revoke");
    expect(revokeData.args).toEqual([snapshot.strategyHash]);

    const dock = buildOwnerControlCalls(snapshot, mandateApp, "DOCK");
    expect(dock).toHaveLength(1);
    expect(dock[0].to).toBe(snapshot.aqua.address);
    const dockData = decodeFunctionData({
      abi: parseAbi(["function dock(address app,bytes32 strategyHash,address[] tokens)"]),
      data: dock[0].data!,
    });
    expect(dockData.functionName).toBe("dock");
    expect(dockData.args).toEqual([
      mandateApp,
      snapshot.strategyHash,
      [snapshot.strategy.tokenIn, snapshot.strategy.tokenOut],
    ]);
  });

  it("denies a wrong smart account without submitting a revoke or dock transaction", async () => {
    const sendTransaction = vi.fn();

    await expect(
      submitOwnerControl(
        { account: { address: address("7") }, sendTransaction },
        snapshot,
        mandateApp,
        "REVOKE",
      ),
    ).resolves.toEqual({ kind: "UNAUTHORIZED" });
    await expect(
      submitOwnerControl(
        { account: { address: address("7") }, sendTransaction },
        snapshot,
        mandateApp,
        "DOCK",
      ),
    ).resolves.toEqual({ kind: "UNAUTHORIZED" });
    expect(sendTransaction).not.toHaveBeenCalled();
  });

  it("preserves the standard unavailable and wallet-rejection states", async () => {
    await expect(submitOwnerControl(undefined, snapshot, mandateApp, "REVOKE")).resolves.toEqual({
      kind: "UNAVAILABLE",
    });

    const rejected = { account: { address: snapshot.strategy.maker }, sendTransaction: vi.fn() };
    rejected.sendTransaction.mockRejectedValue({ code: 4001 });
    await expect(submitOwnerControl(rejected, snapshot, mandateApp, "DOCK")).resolves.toEqual({
      kind: "REJECTED",
    });
  });
});
