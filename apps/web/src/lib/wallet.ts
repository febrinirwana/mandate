import type { MandateSnapshotV1, SimulationRequestV1, StrategyV1 } from "@mandate/domain";
import { mandateAquaAppAbi } from "@mandate/contracts/mandate-aqua-app";
import {
  decodeFunctionResult,
  encodeFunctionData,
  parseAbi,
  type Address,
  type Hex,
} from "viem";

import { buildExecutionIntent, encodeStrategy } from "@/lib/mandate";

export type WalletState =
  | { kind: "IDLE" }
  | { kind: "REJECTED" }
  | { kind: "SUBMITTED"; txHash: Hex }
  | { kind: "CONFIRMED"; txHash: Hex }
  | { kind: "REVERTED"; message: string }
  | { kind: "WRONG_CHAIN"; actual: string }
  | { kind: "WRONG_ACCOUNT"; actual: string }
  | { kind: "UNAVAILABLE" };

type Provider = { request(args: { method: string; params?: unknown[] }): Promise<unknown> };

declare global {
  interface Window {
    ethereum?: Provider;
  }
}

const erc20Abi = parseAbi(["function approve(address spender,uint256 amount) returns (bool)"]);
const aquaAbi = parseAbi([
  "function ship(address app,bytes strategy,address[] tokens,uint256[] amounts) returns (bytes32)",
  "function dock(address app,bytes32 strategyHash,address[] tokens)",
]);

function provider(): Provider | null {
  return window.ethereum ?? null;
}

function rejection(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 4001;
}

async function selectedAccount(wallet: Provider): Promise<Address | null> {
  const accounts = await wallet.request({ method: "eth_requestAccounts" });
  if (!Array.isArray(accounts) || typeof accounts[0] !== "string") return null;
  const account = accounts[0];
  return /^0x[0-9a-fA-F]{40}$/.test(account) ? (account.toLowerCase() as Address) : null;
}
async function send(
  expectedChainId: string,
  expectedAccount: Address,
  to: Address,
  data: Hex,
): Promise<WalletState> {
  const wallet = provider();
  if (!wallet) return { kind: "UNAVAILABLE" };
  try {
    const [chain, account] = await Promise.all([
      wallet.request({ method: "eth_chainId" }),
      selectedAccount(wallet),
    ]);
    const actualChain = typeof chain === "string" ? BigInt(chain).toString() : "unknown";
    if (actualChain !== expectedChainId) return { kind: "WRONG_CHAIN", actual: actualChain };
    if (!account) return { kind: "UNAVAILABLE" };
    if (account !== expectedAccount.toLowerCase()) return { kind: "WRONG_ACCOUNT", actual: account };
    const hash = await wallet.request({
      method: "eth_sendTransaction",
      params: [{ from: account, to, data, value: "0x0" }],
    });
    return typeof hash === "string" && /^0x[0-9a-fA-F]{64}$/.test(hash)
      ? { kind: "SUBMITTED", txHash: hash.toLowerCase() as Hex }
      : { kind: "REVERTED", message: "Wallet returned no transaction hash" };
  } catch (error) {
    return rejection(error)
      ? { kind: "REJECTED" }
      : { kind: "REVERTED", message: "Wallet could not submit this exact transaction" };
  }
}

export async function confirmSubmitted(transaction: WalletState): Promise<WalletState> {
  if (transaction.kind !== "SUBMITTED") return transaction;
  const wallet = provider();
  if (!wallet) return { kind: "UNAVAILABLE" };
  try {
    const receipt = await wallet.request({
      method: "eth_getTransactionReceipt",
      params: [transaction.txHash],
    });
    if (!receipt || typeof receipt !== "object" || !("status" in receipt)) return transaction;
    return receipt.status === "0x1"
      ? { kind: "CONFIRMED", txHash: transaction.txHash }
      : { kind: "REVERTED", message: "Transaction receipt status is reverted" };
  } catch {
    return transaction;
  }
}

export async function readAquaAddress(mandateApp: Address): Promise<Address | null> {
  const wallet = provider();
  if (!wallet) return null;
  try {
    const data = encodeFunctionData({ abi: mandateAquaAppAbi, functionName: "AQUA" });
    const result = await wallet.request({ method: "eth_call", params: [{ to: mandateApp, data }, "latest"] });
    if (typeof result !== "string") return null;
    return decodeFunctionResult({ abi: mandateAquaAppAbi, functionName: "AQUA", data: result as Hex });
  } catch {
    return null;
  }
}

export function approveAqua(
  chainId: string,
  owner: Address,
  aqua: Address,
  token: Address,
  amount: string,
): Promise<WalletState> {
  return send(
    chainId,
    owner,
    token,
    encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [aqua, BigInt(amount)] }),
  );
}

export function shipStrategy(
  chainId: string,
  owner: Address,
  aqua: Address,
  mandateApp: Address,
  strategy: StrategyV1,
): Promise<WalletState> {
  return send(
    chainId,
    owner,
    aqua,
    encodeFunctionData({
      abi: aquaAbi,
      functionName: "ship",
      args: [
        mandateApp,
        encodeStrategy(strategy),
        [strategy.tokenIn, strategy.tokenOut],
        [BigInt(strategy.maxInputTotal), 0n],
      ],
    }),
  );
}

export function activateStrategy(chainId: string, owner: Address, mandateApp: Address, strategy: StrategyV1) {
  return send(
    chainId,
    owner,
    mandateApp,
    encodeFunctionData({
      abi: mandateAquaAppAbi,
      functionName: "activate",
      args: [{
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
      }],
    }),
  );
}

export function submitExecution(request: SimulationRequestV1): Promise<WalletState> {
  const intent = buildExecutionIntent(request);
  return send(intent.request.chainId, intent.request.strategy.agent, intent.request.mandateApp, intent.calldata);
}

export function revokeMandate(
  snapshot: MandateSnapshotV1,
  mandateApp: Address,
): Promise<WalletState> {
  return send(
    snapshot.chainId,
    snapshot.strategy.maker,
    mandateApp,
    encodeFunctionData({ abi: mandateAquaAppAbi, functionName: "revoke", args: [snapshot.strategyHash] }),
  );
}

export function dockStrategy(
  snapshot: MandateSnapshotV1,
  mandateApp: Address,
): Promise<WalletState> {
  return send(
    snapshot.chainId,
    snapshot.strategy.maker,
    snapshot.aqua.address,
    encodeFunctionData({
      abi: aquaAbi,
      functionName: "dock",
      args: [mandateApp, snapshot.strategyHash, [snapshot.strategy.tokenIn, snapshot.strategy.tokenOut]],
    }),
  );
}
