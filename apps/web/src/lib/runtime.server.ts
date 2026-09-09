import "server-only";

import { AddressSchema, PositiveUint256StringSchema } from "@mandate/domain";
import { parsePolicyProfile, type PolicyProfileV1 } from "@/lib/policy";
export type MandateRuntime = {
  chainId: string;
  mandateApp: `0x${string}`;
  policyProfile?: PolicyProfileV1;
  privyEnabled: boolean;
};

export function runtimeConfig(): MandateRuntime | null {
  const mandateApp = process.env["MANDATE_APP"] ?? process.env["SEPOLIA_MANDATE_APP"];
  if (!mandateApp) return null;

  const parsed = AddressSchema.safeParse(mandateApp.toLowerCase());
  if (!parsed.success) return null;

  const chainId = process.env["MANDATE_CHAIN_ID"] ?? "11155111";
  const exactChainId = PositiveUint256StringSchema.safeParse(chainId);
  if (!exactChainId.success) return null;

  return {
    chainId: exactChainId.data,
    mandateApp: parsed.data,
    policyProfile: parsePolicyProfile(process.env["MANDATE_POLICY_PROFILE"]),
    privyEnabled: Boolean(process.env["NEXT_PUBLIC_PRIVY_APP_ID"]),
  };
}

export function apiOrigin(): string {
  return process.env["MANDATE_API_ORIGIN"] ?? "http://127.0.0.1:3001";
}
