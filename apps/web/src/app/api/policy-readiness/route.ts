import { NextResponse } from "next/server";

import { checkPolicyReadiness } from "@/lib/policy-readiness";
import { runtimeConfig } from "@/lib/runtime.server";

export async function GET() {
  const runtime = runtimeConfig();
  if (!runtime?.policyProfile) return NextResponse.json({ kind: "UNAVAILABLE" }, { status: 503 });

  const readiness = await checkPolicyReadiness({
    mandateApp: runtime.mandateApp,
    profile: runtime.policyProfile,
    rpcUrl: process.env.SEPOLIA_RPC_URL,
  });
  return NextResponse.json(readiness, { status: readiness.kind === "UNAVAILABLE" ? 503 : 200 });
}
