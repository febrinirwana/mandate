import type { StrategyV1 } from "@mandate/domain";
import { mandateAquaAppAbi } from "@mandate/contracts/mandate-aqua-app";
import { encodeFunctionData, maxUint256, parseAbi } from "viem";

import { encodeStrategy } from "@/lib/mandate";
import type { WalletState } from "@/lib/wallet";

export type SmartWalletCall = {
  to: `0x${string}`;
  data?: `0x${string}`;
  value?: bigint;
};

export type SmartWalletClient = {
  sendTransaction(input: { calls: SmartWalletCall[] }): Promise<`0x${string}`>;
};

const erc20Abi = parseAbi(["function approve(address spender,uint256 amount) returns (bool)"]);
const mintableErc20Abi = parseAbi(["function mint(address account,uint256 amount)"]);
const aquaAbi = parseAbi([
  "function ship(address app,bytes strategy,address[] tokens,uint256[] amounts) returns (bytes32)",
]);

function activateArgs(strategy: StrategyV1) {
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

export function buildDemoFaucetCall(
  token: `0x${string}`,
  recipient: `0x${string}`,
  amount: bigint,
): SmartWalletCall {
  return {
    to: token,
    data: encodeFunctionData({
      abi: mintableErc20Abi,
      functionName: "mint",
      args: [recipient, amount],
    }),
  };
}

export function buildAuthorityCalls(
  aqua: `0x${string}`,
  mandateApp: `0x${string}`,
  strategy: StrategyV1,
): SmartWalletCall[] {
  return [
    {
      to: strategy.tokenIn,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [aqua, maxUint256],
      }),
    },
    {
      to: strategy.tokenOut,
      data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [aqua, 0n] }),
    },
    {
      to: aqua,
      data: encodeFunctionData({
        abi: aquaAbi,
        functionName: "ship",
        args: [
          mandateApp,
          encodeStrategy(strategy),
          [strategy.tokenIn, strategy.tokenOut],
          [BigInt(strategy.maxInputTotal), 0n],
        ],
      }),
    },
    {
      to: mandateApp,
      data: encodeFunctionData({
        abi: mandateAquaAppAbi,
        functionName: "activate",
        args: [activateArgs(strategy)],
      }),
    },
  ];
}

export async function submitSmartWalletCalls(
  client: SmartWalletClient | undefined,
  calls: SmartWalletCall[],
): Promise<WalletState> {
  if (!client) return { kind: "UNAVAILABLE" };
  try {
    return { kind: "SUBMITTED", txHash: await client.sendTransaction({ calls }) };
  } catch (error) {
    return typeof error === "object" && error !== null && "code" in error && error.code === 4001
      ? { kind: "REJECTED" }
      : { kind: "REVERTED", message: String(error) };
  }
}
