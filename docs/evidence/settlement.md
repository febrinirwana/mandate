# Mainnet Fork Settlement Evidence

## Scope

Mandate uses a dual proof because ENSv2 is available on Sepolia while 1inch Aqua and Classic Swap liquidity are verified on Ethereum mainnet:

- `docs/evidence/ensv2-sepolia.md` proves the live ENSv2 authorization and revocation boundary on Sepolia.
- This record proves the exact production `MandateAquaApp` against official Aqua and a live 1inch route on a pinned Ethereum mainnet fork.

These are separate proofs. The product does not claim cross-chain atomicity.

## Captured venue

Run from the repository root:

```bash
pnpm --filter @mandate/chain capture:route
```

The command requests a live 1inch Classic Swap v6.1 exact-input route, rejects unsafe route shapes, reads runtime bytecode and token metadata at one finalized block, and atomically writes `packages/contracts/src/deployments/mainnet.json`. Neither the API key nor the RPC URL is written to the manifest.

Evidence captured on 7 September 2026:

| Field            | Value                                                                           |
| ---------------- | ------------------------------------------------------------------------------- |
| Chain            | Ethereum mainnet, `1`                                                           |
| Finalized block  | `25924448`                                                                      |
| Block hash       | `0xf3f0a18d22c90db7a5e144d70be1293653a349d2bd2fc28d4a69ead489c2814b`            |
| Request ID       | `431589eb1f7d1a7ca21e08068577c69f`                                              |
| Response hash    | `0x19accb7ffa47cf433782ab3ce23e1679d9792438c9059cf01352413a47167d64`            |
| Mandate app      | `0x29e72b3700facc83f083bfbf051ce5ecc5c13bd7`                                    |
| Router           | `0x111111125421ca6dc452d289314280a0f8842a65`                                    |
| Executor         | `0x111116053f09d34a7eae8102887004445176ca11`                                    |
| Selector         | `0x07ed2379`                                                                    |
| Calldata schema  | `swap(address,(address,address,address,address,uint256,uint256,uint256),bytes)` |
| Calldata hash    | `0x6ec6412659aaccb994ff7b25a9729495c43248e61a179303fb33a550a9f202bf`            |
| Pair             | WETH → USDC                                                                     |
| Exact input      | `100000000000000000` wei WETH                                                   |
| Quoted output    | `248758017` units USDC                                                          |
| Route minimum    | `246270436` units USDC                                                          |
| Liquidity source | `UNISWAP_V3`                                                                    |

The admission boundary decodes the router calldata and requires:

- canonical router target and Mandate caller/recipient;
- exact WETH/USDC token pair and full input amount;
- zero transaction value and zero router flags;
- route source receiver equal to the verified executor;
- non-empty executor data and a positive minimum no greater than the quote;
- runtime code for Aqua, router, executor, WETH, USDC, and deterministic deployer at the same block.

## Production settlement proof

Set `SETTLEMENT_FORK_RPC_URL` in the local ignored `.env`, then run:

```bash
pnpm verify:venue
```

`verify:venue` reads the block from the committed venue manifest, forks that exact block, deploys the unmodified production `MandateAquaApp` through the deterministic CREATE2 deployer to the captured route recipient, activates a real Aqua strategy, simulates the exact call with snapshot rollback, and executes the same calldata.

Observed result:

```text
[PASS] testProductionMandateSettlesCaptured1inchRouteWithExactDeltas()
inputAmount: 100000000000000000
outputAmount: 248417798
1 passed; 0 failed; 0 skipped
```

The proof asserts these consumer-visible invariants:

- maker physical WETH delta is exactly `-100000000000000000`;
- maker physical USDC delta is exactly `+248417798`;
- Aqua virtual WETH and USDC deltas match those physical deltas;
- the Mandate app and dedicated agent retain neither token;
- router and Aqua allowances from the app are reset to zero;
- the same receipt log set contains Aqua `Pulled`, Aqua `Pushed`, and `MandateExecuted` events.

The exact output is lower than the earlier live quote but remains above the admitted `246270436` minimum at the pinned block. This demonstrates bounded execution rather than hard-coded quote equality.

## Reproduction requirements

- Node.js and pnpm versions pinned by the repository.
- Foundry available as `forge`, or its executable path in `FORGE_BIN`.
- An archival Ethereum RPC URL in `SETTLEMENT_FORK_RPC_URL` that can serve block `25924448`.
- A 1inch developer API key in `ONEINCH_API_KEY` only when recapturing the route; replaying the committed proof does not require it.
