import { describe, expect, it, vi } from "vitest";

import { submitSmartWalletCalls, type SmartWalletCall } from "../src/lib/privy-wallet";

const calls = [
  { to: "0x1111111111111111111111111111111111111111", data: "0xabcdef12" },
  { to: "0x2222222222222222222222222222222222222222", data: "0x12345678" },
] satisfies SmartWalletCall[];

describe("Privy smart wallet adapter", () => {
  it("submits the exact compiled calls as one smart-wallet request", async () => {
    const client = { sendTransaction: vi.fn().mockResolvedValue("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa") };

    await expect(submitSmartWalletCalls(client, calls)).resolves.toEqual({
      kind: "SUBMITTED",
      txHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    });
    expect(client.sendTransaction).toHaveBeenCalledWith({ calls });
  });

  it("fails closed when a smart wallet is unavailable", async () => {
    await expect(submitSmartWalletCalls(undefined, calls)).resolves.toEqual({ kind: "UNAVAILABLE" });
  });

  it("preserves an explicit wallet rejection", async () => {
    const client = { sendTransaction: vi.fn().mockRejectedValue({ code: 4001 }) };

    await expect(submitSmartWalletCalls(client, calls)).resolves.toEqual({ kind: "REJECTED" });
  });
});
