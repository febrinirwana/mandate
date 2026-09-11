import { describe, expect, it, vi } from "vitest";
import { decodeFunctionData, parseAbi } from "viem";

import {
  buildAuthorityCalls,
  buildDemoFaucetCall,
  submitSmartWalletCalls,
  type SmartWalletCall,
} from "../src/lib/privy-wallet";

const address = (digit: string): `0x${string}` => `0x${digit.repeat(40)}`;
const hash = (digit: string): `0x${string}` => `0x${digit.repeat(64)}`;
const calls = [
  { to: address("1"), data: "0xabcdef12" },
  { to: address("2"), data: "0x12345678" },
] satisfies SmartWalletCall[];
const strategy = {
  version: 1 as const,
  maker: address("1"),
  agent: address("2"),
  ensRegistry: address("3"),
  ensResolver: address("4"),
  ensLabel: "nova",
  ensNode: hash("5"),
  tokenIn: address("6"),
  tokenOut: address("7"),
  swapTarget: address("8"),
  swapSelector: "0x12345678" as const,
  minRateNumerator: "1",
  minRateDenominator: "2",
  maxInputPerCall: "500",
  maxInputTotal: "1000",
  validAfter: "1",
  validUntil: "2000000000",
  salt: hash("9"),
};

describe("Privy smart wallet adapter", () => {
  it("submits the exact compiled calls as one smart-wallet request", async () => {
    const client = { sendTransaction: vi.fn().mockResolvedValue(hash("a")) };
    await expect(submitSmartWalletCalls(client, calls)).resolves.toEqual({
      kind: "SUBMITTED",
      txHash: hash("a"),
    });
    expect(client.sendTransaction).toHaveBeenCalledWith({ calls });
  });

  it("fails closed when a smart wallet is unavailable", async () => {
    await expect(submitSmartWalletCalls(undefined, calls)).resolves.toEqual({
      kind: "UNAVAILABLE",
    });
  });

  it("preserves an explicit wallet rejection", async () => {
    const client = { sendTransaction: vi.fn().mockRejectedValue({ code: 4001 }) };
    await expect(submitSmartWalletCalls(client, calls)).resolves.toEqual({ kind: "REJECTED" });
  });

  it("uses a durable Aqua allowance so one mandate cannot consume another mandate's approval", () => {
    const aqua = address("a");
    const mandateApp = address("b");
    const batch = buildAuthorityCalls(aqua, mandateApp, strategy);

    expect(batch.map((call) => call.to)).toEqual([
      strategy.tokenIn,
      strategy.tokenOut,
      aqua,
      mandateApp,
    ]);
    const inputApproval = decodeFunctionData({
      abi: parseAbi(["function approve(address spender,uint256 amount) returns (bool)"]),
      data: batch[0].data!,
    }).args;
    const outputApproval = decodeFunctionData({
      abi: parseAbi(["function approve(address spender,uint256 amount) returns (bool)"]),
      data: batch[1].data!,
    }).args;
    expect([String(inputApproval?.[0]).toLowerCase(), inputApproval?.[1]]).toEqual([
      aqua,
      (1n << 256n) - 1n,
    ]);
    expect([String(outputApproval?.[0]).toLowerCase(), outputApproval?.[1]]).toEqual([aqua, 0n]);
  });

  it("mints the exact demo amount only to the smart-wallet owner", () => {
    const token = address("c");
    const owner = address("d");
    const call = buildDemoFaucetCall(token, owner, 100_000_000n);

    expect(call.to).toBe(token);
    const mint = decodeFunctionData({
      abi: parseAbi(["function mint(address account,uint256 amount)"]),
      data: call.data!,
    });
    expect(mint.functionName).toBe("mint");
    expect([String(mint.args[0]).toLowerCase(), mint.args[1]]).toEqual([owner, 100_000_000n]);
  });
});
