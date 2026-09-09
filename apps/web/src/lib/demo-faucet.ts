import type { Address } from "@mandate/domain";
import { decodeFunctionResult, encodeFunctionData, parseAbi, parseUnits, type Hex } from "viem";

export type DemoFundingState =
  | {
      kind: "READY";
      balance: string;
      faucetAmount: string;
      funded: boolean;
      blockNumber: string;
    }
  | { kind: "UNAVAILABLE" };

const UINT = /^(?:0|[1-9][0-9]*)$/;

export function parseDemoFundingState(value: unknown): DemoFundingState {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { kind: "UNAVAILABLE" };
  }
  const state = value as Record<string, unknown>;
  if (state.kind === "UNAVAILABLE" && Object.keys(state).length === 1) {
    return { kind: "UNAVAILABLE" };
  }
  if (
    state.kind !== "READY" ||
    Object.keys(state).length !== 5 ||
    typeof state.balance !== "string" ||
    !UINT.test(state.balance) ||
    typeof state.faucetAmount !== "string" ||
    !UINT.test(state.faucetAmount) ||
    state.faucetAmount === "0" ||
    typeof state.blockNumber !== "string" ||
    !UINT.test(state.blockNumber) ||
    typeof state.funded !== "boolean" ||
    state.funded !== BigInt(state.balance) >= BigInt(state.faucetAmount)
  ) {
    return { kind: "UNAVAILABLE" };
  }
  return state as DemoFundingState;
}

export function didDemoFundingConfirm(
  previousBalance: bigint | undefined,
  current: DemoFundingState,
): boolean {
  return (
    previousBalance !== undefined &&
    current.kind === "READY" &&
    BigInt(current.balance) > previousBalance
  );
}

type FundingInput = {
  account: Address;
  token: Address;
  faucetAmount: bigint;
  rpcUrl: string | undefined;
  fetcher?: typeof fetch;
};

const balanceAbi = parseAbi(["function balanceOf(address account) view returns (uint256)"]);

export function demoFaucetRawAmount(
  value: string | undefined,
  decimals: number,
): bigint | undefined {
  if (!value) return undefined;
  try {
    const amount = parseUnits(value, decimals);
    return amount > 0n ? amount : undefined;
  } catch {
    return undefined;
  }
}

async function rpc(
  fetcher: typeof fetch,
  url: string,
  method: string,
  params: unknown[],
): Promise<unknown> {
  const response = await fetcher(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const body = (await response.json()) as { result?: unknown; error?: unknown };
  if (!response.ok || body.error !== undefined || body.result === undefined)
    throw new Error("RPC unavailable");
  return body.result;
}

export async function readDemoFunding({
  account,
  token,
  faucetAmount,
  rpcUrl,
  fetcher = fetch,
}: FundingInput): Promise<DemoFundingState> {
  if (!rpcUrl) return { kind: "UNAVAILABLE" };
  try {
    const block = await rpc(fetcher, rpcUrl, "eth_blockNumber", []);
    if (typeof block !== "string" || !/^0x[0-9a-f]+$/i.test(block)) return { kind: "UNAVAILABLE" };
    const data = encodeFunctionData({
      abi: balanceAbi,
      functionName: "balanceOf",
      args: [account],
    });
    const result = await rpc(fetcher, rpcUrl, "eth_call", [{ to: token, data }, block]);
    if (typeof result !== "string" || !/^0x[0-9a-f]+$/i.test(result))
      return { kind: "UNAVAILABLE" };
    const balance = decodeFunctionResult({
      abi: balanceAbi,
      functionName: "balanceOf",
      data: result as Hex,
    });
    return {
      kind: "READY",
      balance: balance.toString(),
      faucetAmount: faucetAmount.toString(),
      funded: balance >= faucetAmount,
      blockNumber: BigInt(block).toString(),
    };
  } catch {
    return { kind: "UNAVAILABLE" };
  }
}
