import { describe, expect, it, vi } from "vitest";
import { encodeFunctionResult, parseAbi } from "viem";

import {
  demoFaucetRawAmount,
  didDemoFundingConfirm,
  parseDemoFundingState,
  readDemoFunding,
} from "../src/lib/demo-faucet";

const account = "0x1111111111111111111111111111111111111111" as const;
const tokenAddress = "0x2222222222222222222222222222222222222222" as const;
const balanceAbi = parseAbi(["function balanceOf(address account) view returns (uint256)"]);

describe("Sepolia demo funding", () => {
  it("reads the owner balance at one explicit block", async () => {
    const fetcher = vi.fn<typeof fetch>((_input, init) => {
      const request = JSON.parse(typeof init?.body === "string" ? init.body : "") as {
        method: string;
        params: unknown[];
      };
      if (request.method === "eth_blockNumber") {
        return Promise.resolve(Response.json({ jsonrpc: "2.0", id: 1, result: "0x2a" }));
      }
      expect(request.method).toBe("eth_call");
      expect(request.params[1]).toBe("0x2a");
      return Promise.resolve(
        Response.json({
          jsonrpc: "2.0",
          id: 1,
          result: encodeFunctionResult({
            abi: balanceAbi,
            functionName: "balanceOf",
            result: 150_000_000n,
          }),
        }),
      );
    });

    await expect(
      readDemoFunding({
        account,
        token: tokenAddress,
        faucetAmount: 100_000_000n,
        rpcUrl: "https://rpc.example",
        fetcher,
      }),
    ).resolves.toEqual({
      kind: "READY",
      balance: "150000000",
      faucetAmount: "100000000",
      funded: true,
      blockNumber: "42",
    });
  });

  it("fails closed when the server RPC is unavailable", async () => {
    const fetcher = vi.fn<typeof fetch>(() => Promise.resolve(new Response(null, { status: 503 })));

    await expect(
      readDemoFunding({
        account,
        token: tokenAddress,
        faucetAmount: 100_000_000n,
        rpcUrl: "https://rpc.example",
        fetcher,
      }),
    ).resolves.toEqual({ kind: "UNAVAILABLE" });
  });

  it("accepts only a positive decimal faucet amount", () => {
    expect(demoFaucetRawAmount("100", 6)).toBe(100_000_000n);
    expect(demoFaucetRawAmount("0", 6)).toBeUndefined();
    expect(demoFaucetRawAmount("free", 6)).toBeUndefined();
  });

  it("rejects malformed browser funding responses", () => {
    expect(
      parseDemoFundingState({
        kind: "READY",
        balance: "-1",
        faucetAmount: "100000000",
        funded: true,
        blockNumber: "42",
      }),
    ).toEqual({ kind: "UNAVAILABLE" });
    expect(parseDemoFundingState({ kind: "READY", balance: "100000000" })).toEqual({
      kind: "UNAVAILABLE",
    });
  });

  it("confirms funding only after the observed balance increases", () => {
    const same = {
      kind: "READY" as const,
      balance: "100000000",
      faucetAmount: "100000000",
      funded: true,
      blockNumber: "43",
    };
    expect(didDemoFundingConfirm(100_000_000n, same)).toBe(false);
    expect(didDemoFundingConfirm(100_000_000n, { ...same, balance: "200000000" })).toBe(true);
    expect(didDemoFundingConfirm(100_000_000n, { kind: "UNAVAILABLE" })).toBe(false);
  });
});
