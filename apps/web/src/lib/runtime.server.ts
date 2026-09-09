import { AddressSchema, PositiveUint256StringSchema } from "@mandate/domain";
import { parsePolicyProfile, type PolicyProfileV1 } from "@/lib/policy";
import { demoFaucetRawAmount } from "@/lib/demo-faucet";
export type MandateRuntime = {
  chainId: string;
  mandateApp: `0x${string}`;
  policyProfile?: PolicyProfileV1;
  demoFaucetAmount?: string;
  local: boolean;
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

  const local = Boolean(process.env["MANDATE_LOCAL_RPC_URL"]);
  const policyProfile = parsePolicyProfile(
    local ? process.env["MANDATE_LOCAL_POLICY_PROFILE"] : process.env["MANDATE_POLICY_PROFILE"],
  );
  const configuredFaucetAmount = process.env["MANDATE_SEPOLIA_FAUCET_AMOUNT"];
  const demoFaucetAmount =
    exactChainId.data === "11155111" &&
    policyProfile &&
    demoFaucetRawAmount(configuredFaucetAmount, policyProfile.tokenIn.decimals)
      ? configuredFaucetAmount
      : undefined;

  return {
    chainId: exactChainId.data,
    mandateApp: parsed.data,
    local,
    policyProfile,
    demoFaucetAmount,
    privyEnabled: Boolean(process.env["NEXT_PUBLIC_PRIVY_APP_ID"]),
  };
}

export function apiOrigin(): string {
  return process.env["MANDATE_API_ORIGIN"] ?? "http://127.0.0.1:3001";
}
