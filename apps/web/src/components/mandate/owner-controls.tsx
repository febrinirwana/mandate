"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { encodeFunctionData, parseAbi } from "viem";
import { useState } from "react";

import { MandateProviders } from "@/components/providers";
import { Button } from "@/components/ui/kit";
import type { SmartWalletCall, SmartWalletClient } from "@/lib/privy-wallet";
import { submitSmartWalletCalls } from "@/lib/privy-wallet";
import type { WalletState } from "@/lib/wallet";

const aquaAbi = parseAbi(["function dock(address app,bytes32 strategyHash,address[] tokens)"]);
const revokeAbi = parseAbi(["function revoke(bytes32 hash)"]);

type OwnerControlSnapshot = {
  strategyHash: `0x${string}`;
  aqua: { address: `0x${string}` };
  strategy: {
    maker: `0x${string}`;
    tokenIn: `0x${string}`;
    tokenOut: `0x${string}`;
    maxInputTotal: string;
  };
  state: { usedInput: string };
};
type OwnerControlAction = "RESTORE_APPROVAL" | "REVOKE" | "DOCK";
type OwnerSmartWalletClient = SmartWalletClient & { account: { address: `0x${string}` } };
type OwnerControlState = WalletState | { kind: "UNAUTHORIZED" };

export function canManageAuthority(
  account: `0x${string}` | undefined,
  maker: `0x${string}`,
): boolean {
  return Boolean(account && account.toLowerCase() === maker.toLowerCase());
}

export function buildOwnerControlCalls(
  snapshot: OwnerControlSnapshot,
  mandateApp: `0x${string}`,
  action: OwnerControlAction,
): SmartWalletCall[] {
  if (action === "RESTORE_APPROVAL") {
    const remaining = BigInt(snapshot.strategy.maxInputTotal) - BigInt(snapshot.state.usedInput);
    return [
      {
        to: snapshot.strategy.tokenIn,
        data: encodeFunctionData({
          abi: parseAbi(["function approve(address spender,uint256 amount) returns (bool)"]),
          functionName: "approve",
          args: [snapshot.aqua.address, remaining > 0n ? remaining : 0n],
        }),
      },
    ];
  }
  if (action === "REVOKE") {
    return [
      {
        to: mandateApp,
        data: encodeFunctionData({
          abi: revokeAbi,
          functionName: "revoke",
          args: [snapshot.strategyHash],
        }),
      },
    ];
  }
  return [
    {
      to: snapshot.aqua.address,
      data: encodeFunctionData({
        abi: aquaAbi,
        functionName: "dock",
        args: [
          mandateApp,
          snapshot.strategyHash,
          [snapshot.strategy.tokenIn, snapshot.strategy.tokenOut],
        ],
      }),
    },
  ];
}

export async function submitOwnerControl(
  client: OwnerSmartWalletClient | undefined,
  snapshot: OwnerControlSnapshot,
  mandateApp: `0x${string}`,
  action: OwnerControlAction,
): Promise<OwnerControlState> {
  if (!client) return { kind: "UNAVAILABLE" };
  if (!canManageAuthority(client.account.address, snapshot.strategy.maker))
    return { kind: "UNAUTHORIZED" };
  return submitSmartWalletCalls(client, buildOwnerControlCalls(snapshot, mandateApp, action));
}

function OwnerControlIsland({
  snapshot,
  mandateApp,
  onSubmitted,
}: {
  snapshot: OwnerControlSnapshot;
  mandateApp: `0x${string}`;
  onSubmitted: () => void;
}) {
  const { authenticated, login, logout, ready } = usePrivy();
  const { client } = useSmartWallets();
  const [state, setState] = useState<OwnerControlState>({ kind: "UNAVAILABLE" });
  const wallet = client as unknown as OwnerSmartWalletClient | undefined;
  const allowed = canManageAuthority(wallet?.account.address, snapshot.strategy.maker);

  async function submit(action: OwnerControlAction) {
    const result = await submitOwnerControl(wallet, snapshot, mandateApp, action);
    setState(result);
    if (result.kind === "SUBMITTED") onSubmitted();
  }

  return (
    <div className="border border-rule bg-raised p-6">
      <p className="ledger-label text-ink-3">Owner smart account only</p>
      <p className="mt-3 text-[0.9375rem] text-ink-2">
        Revoke stops this mandate; docking clears its Aqua allocation. These actions use the Privy
        smart account, never the authentication EOA.
      </p>
      {!authenticated && ready ? (
        <div className="mt-5 border-l-2 border-accent pl-4">
          <p role="status" className="text-sm text-ink-2">
            Sign in with the same Privy owner identity used to issue this authority.
          </p>
          <Button className="mt-3" onClick={() => void login()}>
            Sign in to manage
          </Button>
        </div>
      ) : !allowed ? (
        <p role="status" className="mono-data mt-4 text-revoked">
          The connected smart account is not this mandate’s maker. Nothing can be submitted.
        </p>
      ) : (
        <p role="status" className="mono-data mt-4 text-confirmed">
          Owner smart account verified.
        </p>
      )}
      {authenticated && (
        <Button className="mt-4" variant="ghost" onClick={() => void logout()}>
          Sign out
        </Button>
      )}
      <div className="mt-5 border-l-2 border-accent pl-4">
        <p className="text-sm text-ink-2">
          If another mandate consumed this wallet&apos;s shared Aqua allowance, restore it without
          changing this mandate&apos;s immutable cap.
        </p>
        <Button
          className="mt-3"
          variant="ghost"
          disabled={!authenticated || !allowed}
          onClick={() => void submit("RESTORE_APPROVAL")}
        >
          Restore execution approval
        </Button>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <Button
          variant="carbon"
          disabled={!authenticated || !allowed}
          onClick={() => void submit("REVOKE")}
        >
          Revoke mandate
        </Button>
        <Button
          variant="ghost"
          disabled={!authenticated || !allowed}
          onClick={() => void submit("DOCK")}
        >
          Dock Aqua strategy
        </Button>
      </div>
      {state.kind !== "UNAVAILABLE" && (
        <p role="status" className="mono-data mt-4 text-ink-2">
          {state.kind === "UNAUTHORIZED"
            ? "Wrong smart account. Nothing was submitted."
            : state.kind}
        </p>
      )}
    </div>
  );
}

export function OwnerControls({
  snapshot,
  mandateApp,
  onSubmitted,
}: {
  snapshot: OwnerControlSnapshot;
  mandateApp: `0x${string}`;
  onSubmitted: () => void;
}) {
  return (
    <MandateProviders>
      <OwnerControlIsland snapshot={snapshot} mandateApp={mandateApp} onSubmitted={onSubmitted} />
    </MandateProviders>
  );
}
