import { AddressSchema } from "@mandate/domain";
import { NextResponse } from "next/server";

import { demoFaucetRawAmount, readDemoFunding } from "@/lib/demo-faucet";
import { runtimeConfig } from "@/lib/runtime.server";

const unavailable = (status: number) => NextResponse.json({ kind: "UNAVAILABLE" }, { status });

export async function GET(request: Request) {
  const runtime = runtimeConfig();
  const account = AddressSchema.safeParse(
    new URL(request.url).searchParams.get("account")?.toLowerCase(),
  );
  if (!account.success) return unavailable(400);
  if (!runtime?.policyProfile || !runtime.demoFaucetAmount) return unavailable(503);

  const faucetAmount = demoFaucetRawAmount(
    runtime.demoFaucetAmount,
    runtime.policyProfile.tokenIn.decimals,
  );
  if (!faucetAmount) return unavailable(503);

  const state = await readDemoFunding({
    account: account.data,
    token: runtime.policyProfile.tokenIn.address,
    faucetAmount,
    rpcUrl: process.env.MANDATE_LOCAL_RPC_URL ?? process.env.SEPOLIA_RPC_URL,
  });
  return NextResponse.json(state, { status: state.kind === "UNAVAILABLE" ? 503 : 200 });
}
