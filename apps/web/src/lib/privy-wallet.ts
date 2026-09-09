import type { WalletState } from "@/lib/wallet";

export type SmartWalletCall = {
  to: `0x${string}`;
  data?: `0x${string}`;
  value?: bigint;
};

type SmartWalletClient = {
  sendTransaction(input: { calls: SmartWalletCall[] }): Promise<`0x${string}`>;
};


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
