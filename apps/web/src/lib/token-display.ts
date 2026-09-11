import { formatUnits } from "viem";

type Token = { symbol: string; decimals: number };

const raw = (value: string) => Intl.NumberFormat("en-US").format(BigInt(value));

export function formatTokenAmount(value: string, token: Token): string {
  return `${formatUnits(BigInt(value), token.decimals)} ${token.symbol} (${raw(value)} base units)`;
}

export function formatRate(
  numerator: string,
  denominator: string,
  profile: { tokenIn: Token; tokenOut: Token },
): string {
  const oneInput = 10n ** BigInt(profile.tokenIn.decimals);
  const output = (oneInput * BigInt(numerator) + BigInt(denominator) - 1n) / BigInt(denominator);
  return `${formatUnits(output, profile.tokenOut.decimals)} ${profile.tokenOut.symbol} per 1 ${profile.tokenIn.symbol} (raw rate ${numerator}/${denominator})`;
}
