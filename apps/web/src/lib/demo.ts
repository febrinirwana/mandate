/**
 * Synthetic mandate used across the landing demo and the inspection surface.
 *
 * Every value here is illustrative design material, labeled as a sample in
 * the UI. It is NOT live chain state. The product rule stands: unknown fails
 * closed — a real deployment reads and displays onchain truth instead.
 */

export const CHAIN = {
  id: "11155111",
  name: "Sepolia",
  explorer: "https://sepolia.etherscan.io",
} as const;

export const TOKENS = {
  in: { symbol: "USDC", name: "USD Coin", decimals: 6, address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" },
  out: { symbol: "WETH", name: "Wrapped Ether", decimals: 18, address: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B36" },
} as const;

export const DEMO = {
  label: "SAMPLE: synthetic demo state, not live chain data",
  maker: {
    ens: "ops.infinex.eth",
    address: "0x8C4A3fD2B9e15a70Cd4bE6f19aD7E2c583B04d1e",
  },
  agent: {
    ens: "runner-01.ops.infinex.eth",
    address: "0x6fD2a91C4e7b5803dA9cE1f4B2d8E0571cA9b463",
    gasBalanceEth: 0.0412,
    tokenBalance: "0",
  },
  identity: {
    registry: "0xB1d4e8A2c5F09b73D6e1A4c7B2d9E5f80C3a6E45",
    resolver: "0xE2c5a91D4f8B7036cD9eA1f5B3d7C8e40A2b6D19",
    label: "runner-01",
    node: "0x2e5c9a1d8f4b6e37a0c5d291b7e4f830c6a1d5b92e8f03a47c1d6b5e9f2a048b",
    tokenId: "918273645504300227118334529711",
    owner: "0x6fD2a91C4e7b5803dA9cE1f4B2d8E0571cA9b463",
    verifiedAtBlock: 7681945,
    expiry: "2026-10-04T00:00:00Z",
  },
  strategyHash: "0x4a91f2c7d6b3e580a9c1d47fb0e2f53618d7c4a9e5b2f08371c6d9a42f8e0b5d",
  venue: {
    name: "1inch Aggregation Router v6",
    target: "0x111111125421cA6dc452d289314280a0f8842c65",
    selector: "0x12aa3caf",
  },
  aqua: {
    app: "0xA4d7C1e9B3f85206eD1a5c8B4E9d2F7a0C6b3D58",
    /** virtual balance maker -> app -> strategy -> token, base units */
    virtualIn: 3_750_000_000,
    virtualOut: 611_298_000_000_000_000,
  },
  policy: {
    minRateNumerator: 7,
    minRateDenominator: 20_000,
    maxInputPerCall: 1_000_000_000, // 1,000 USDC
    maxInputTotal: 5_000_000_000, // 5,000 USDC
    usedTotal: 1_250_000_000, // 1,250 USDC
    validAfter: "2026-09-04T00:00:00Z",
    validUntil: "2026-10-04T00:00:00Z",
    salt: "0x9c3b81e2d5f40a67b8c1d9e402a5f7b3c8d1e640a92b5f83d7c1e406b9a2f5d8",
  },
  lastExecution: {
    txHash: "0x9d7c41e8b2a65f30d8c4e971b5a2f8360e5d7c19a4b8f2d63e7c1a95f0b4d827",
    block: 7_672_310,
    blockHash: "0x3e7c1a95f0b4d8279d7c41e8b2a65f30d8c4e971b5a2f8360e5d7c19a4b8f2d6",
    timestamp: "2026-09-03T13:22:41Z",
    in: 500_000_000, // 500 USDC
    out: 178_934_000_000_000_000, // 0.178934 WETH
    status: "CONFIRMED",
  },
  simulation: {
    bindingBlock: 7_681_945,
    bindingBlockHash: "0x6d1c8f2a9b4e5073d1a8c5f29e6b0d43a7c1e948b2f5d803e6a1c7d9b4f25e08",
    expiresInSeconds: 84,
    routeQuoteOut: 179_118_000_000_000_000, // 0.179118 WETH for 500 USDC
  },
} as const;

/* ---------------------------------------------------------------- */

export function fmtUnits(base: bigint | number, decimals: number, display = 2): string {
  const value = typeof base === "bigint" ? Number(base) : base;
  const scaled = value / 10 ** decimals;
  return scaled.toLocaleString("en-US", {
    minimumFractionDigits: display,
    maximumFractionDigits: display,
  });
}

export function fmtCompact(base: number, decimals: number): string {
  const scaled = base / 10 ** decimals;
  if (scaled >= 1_000_000) return `${(scaled / 1_000_000).toFixed(2)}M`;
  if (scaled >= 1_000) return `${(scaled / 1_000).toFixed(1)}K`;
  return scaled.toFixed(decimals <= 6 ? 0 : 4);
}

export function minOutput(baseIn: number, inDecimals: number, outDecimals: number, num: number, den: number): number {
  // Ceiling division, decimal-aware: the ratio is stated in display units
  // (tokenOut per tokenIn), so base-unit output carries the decimal gap.
  const outBase = Math.ceil((baseIn * num * 10 ** (outDecimals - inDecimals)) / den);
  return outBase / 10 ** outDecimals;
}

export function rateOf(out: number, outDecimals: number, inBase: number, inDecimals: number): number {
  const outUnits = out / 10 ** outDecimals;
  const inUnits = inBase / 10 ** inDecimals;
  return outUnits / inUnits;
}

export function shortenHex(hex: string, head = 6, tail = 4): string {
  if (hex.length <= head + tail + 2) return hex;
  return `${hex.slice(0, head + 2)}…${hex.slice(-tail)}`;
}

export type StampKind = "ACTIVE" | "PASS" | "CONFIRMED" | "EXPIRING" | "REVOKED" | "FAILED" | "UNKNOWN";

export const STAMP_STYLE: Record<StampKind, { color: string; soft: string }> = {
  ACTIVE: { color: "var(--accent)", soft: "var(--accent-soft)" },
  PASS: { color: "var(--accent)", soft: "var(--accent-soft)" },
  CONFIRMED: { color: "var(--confirmed)", soft: "var(--confirmed-soft)" },
  EXPIRING: { color: "var(--expiring)", soft: "var(--expiring-soft)" },
  REVOKED: { color: "var(--revoked)", soft: "var(--revoked-soft)" },
  FAILED: { color: "var(--revoked)", soft: "var(--revoked-soft)" },
  UNKNOWN: { color: "var(--unknown)", soft: "var(--unknown-soft)" },
};

export const DEMO_STRATEGY_HASH = DEMO.strategyHash;
