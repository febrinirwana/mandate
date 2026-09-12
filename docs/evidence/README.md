# Release Evidence Index

Verified release state as of 12 September 2026. This index maps each submission claim to its shortest public or repository proof. It contains no credential, wallet secret, raw authorization header, or private deployment value.

## Public release

| Claim                             | Evidence                                                                 | Expected observation                                                                      |
| --------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Web release is live               | [`https://mandate-cyan.vercel.app`](https://mandate-cyan.vercel.app)     | Public landing page; Vercel deployment `dpl_79uuvPUe7rWvueysjZfSc9snJjgU` reached `READY` |
| Runtime is configured for Sepolia | [`/api/runtime`](https://mandate-cyan.vercel.app/api/runtime)            | Chain `11155111`, Mandate app `0xffdefe...438f`, Privy enabled                            |
| Public API is live                | [`/openapi.json`](https://mandate-api.43-129-38-115.nip.io/openapi.json) | HTTP 200 OpenAPI 3.1 document                                                             |
| Signer is not public              | Agent execution route                                                    | Missing bearer credential returns HTTP 401; `/health` contains no signer data             |
| Split services are reproducible   | [`deploy/compose.production.yml`](../../deploy/compose.production.yml)   | API, worker, and agent are isolated; worker has no port; agent has no host-published port |

## Canonical Sepolia execution

| Claim                                          | Evidence                                                                                                                                                                                                 | Expected observation                                                               |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Strategy inspection is public                  | [Canonical inspector](https://mandate-cyan.vercel.app/mandates/0x01163a9088c3c0342fd7d8b07f4720c5d52e1c9626cc114923ae4339414f9fcd?tx=0x0d4174a636098d3b0f717cb2e71d721aa646d6cf43ca61f9ae1460c1df75f164) | Exact immutable fields, current ENS/Aqua state, and receipt section                |
| Agent executed the active strategy             | [Transaction `0x0d4174...f164`](https://sepolia.etherscan.io/tx/0x0d4174a636098d3b0f717cb2e71d721aa646d6cf43ca61f9ae1460c1df75f164)                                                                      | Successful transaction at block `11680375`                                         |
| Confirmation is canonical                      | [`/api/executions/...`](https://mandate-cyan.vercel.app/api/executions/11155111/0x0d4174a636098d3b0f717cb2e71d721aa646d6cf43ca61f9ae1460c1df75f164)                                                      | `CONFIRMED`, 1,000,000 raw USDC in and 1e18 raw DAI out                            |
| Incomplete archival evidence is not overstated | [`/api/receipts/.../audit`](https://mandate-cyan.vercel.app/api/receipts/11155111/0x0d4174a636098d3b0f717cb2e71d721aa646d6cf43ca61f9ae1460c1df75f164/audit)                                              | Canonical receipt check passes; unavailable execution-block reads remain `UNKNOWN` |
| Current strategy is exhausted, not reusable    | [`/api/mandates/...`](https://mandate-cyan.vercel.app/api/mandates/11155111/0x01163a9088c3c0342fd7d8b07f4720c5d52e1c9626cc114923ae4339414f9fcd)                                                          | `usedInput` equals `maxInputTotal`; current app and agent token balances are zero  |

## Contract and identity

| Claim                                              | Evidence                                                                                                                                                                                                                                          |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mandate source is an exact deployed match          | [Etherscan source](https://sepolia.etherscan.io/address/0xFfDEfE2eBB164095b471e1F0B7EC492c8D26438F#code); Sourcify job `c3572aaf-ffef-4429-b30d-32329ad3111c`                                                                                     |
| Fixed test venue source is an exact deployed match | [Etherscan source](https://sepolia.etherscan.io/address/0x6690118e223948eE6dabF09e089247854bCcD369#code); Sourcify job `117ee1fd-8167-4a77-a07e-41b2e1aa7df1`                                                                                     |
| Compiler settings are reproducible                 | Etherscan exact match: Solidity `0.8.30`, optimizer 200 runs, Cancun EVM                                                                                                                                                                          |
| ENSv2 identity is load-bearing                     | [`ensv2-sepolia.md`](ensv2-sepolia.md) and [dedicated agent](https://sepolia.etherscan.io/address/0x77606352f523f8a076498aB8BeFF3af3BC1e492A)                                                                                                     |
| Owner-controlled ENS stop works                    | [Unregister](https://sepolia.etherscan.io/tx/0x77c940dae0c33040dd6260f616725b19b09af022816948662bd3ef456c2b3377), then [reverted agent probe](https://sepolia.etherscan.io/tx/0x6185e78ad5d793165b7d139c96b40f1e50e9edb2e7c68d70b16a76a3212989bb) |

## 1inch and Bazantic

| Claim                                                   | Evidence                                                                                                                                                                                                                                      |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production contract settles a captured live 1inch route | [`settlement.md`](settlement.md), pinned mainnet block `25924448`                                                                                                                                                                             |
| Recipe needs both services                              | [`bazantic.md`](bazantic.md): `getClassicSwapRoute` then `assessOneInchRoute`                                                                                                                                                                 |
| Published Recipe completed after stable API rebind      | Bazantic dashboard test on 12 September 2026 returned `Complete`; current Mandate MCP remained `https://oj7vvrmizvfhfpbo737wqdphcq.bazgateway.com/mcp`                                                                                        |
| Both priced ingredients settled through x402            | [1inch Base settlement](https://basescan.org/tx/0x19faef678b5585b9f9a0852e4c3be528d9d94408174a8e4681bc02f3e00f8c6a) and [Mandate Base settlement](https://basescan.org/tx/0x7897578d829caa367a8fd368d30ad0d712d17d063cdc9c4c6c9c9202c1ee3938) |
| Public machine-readable proof is redacted               | [`integrations/bazantic/paid-proof.json`](../../integrations/bazantic/paid-proof.json)                                                                                                                                                        |

## Security and reproducibility

| Claim                                             | Evidence                                                                                                 |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Release boundaries were reviewed and remediated   | [`security-review.md`](security-review.md), remediation commit `8540ac0`                                 |
| Agent is pinned to one release strategy           | Agent tests plus `AGENT_STRATEGY_HASH`; mismatches fail before signing                                   |
| Browser approvals are least privilege             | Web tests decode exact approval calldata and compare it with total or remaining cap                      |
| Production signer route is authenticated          | Agent tests cover missing, wrong, and correct bearer credentials; public missing-auth probe returned 401 |
| Secrets are excluded from artifacts               | Root `pnpm secrets:scan`, `.gitignore`, `.dockerignore`, and `.vercelignore`                             |
| Source revisions and deployment hashes are pinned | [`kickoff.md`](kickoff.md) and `packages/contracts/src/deployments/*.json`                               |

## Honest boundaries

- Sepolia uses official Aqua and a clearly labeled fixed test venue. It does not claim 1inch Classic availability on Sepolia.
- The live 1inch route proof uses Ethereum mainnet data at a pinned mainnet fork block. It is separate from the Sepolia receipt.
- The current historical receipt audit is `UNKNOWN` where the configured RPC cannot serve required execution-block reads.
- The paid Bazantic proof is a same-account self-payment that proves authorization and settlement mechanics, not third-party revenue.
- The security review is focused and first-party, not an independent audit.
