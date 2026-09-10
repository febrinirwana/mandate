# ETHOnline 2026 Kickoff Evidence

Requirements were captured on **4 September 2026 at 23:37 WIB (UTC+7)**. Runtime probes below use the named Sepolia block and its onchain timestamp. Requirements are quoted or compressed from official sources; decisions are Mandate's interpretation.

## Sponsor requirements

| Sponsor track                                                                               | Official requirement                                                                                                                                                                              | Mandate decision                                                                                                                                                                |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [1inch — Build an Aqua App](https://ethglobal.com/events/ethonline2026/prizes#1inch)        | Use official Aqua/SwapVM contracts; show onchain token transfers; forks are allowed; maintain proper Git history. SwapVM use scores higher.                                                       | Build a custom Aqua app. Use official Aqua source/deployment. Use SwapVM only if its admitted route preserves the fixed target, recipient, exact-input, and residue invariants. |
| [ENS — Best Use of ENSv2](https://ethglobal.com/events/ethonline2026/prizes#ens)            | Build on ENSv2 Sepolia; ENSv2 must be central and functional; publish accessible source plus a video or live demo.                                                                                | Read live Permissioned Registry state, expiry, current token owner, resolver pointer, and resolved address during every execution. ENS failure revokes authority.               |
| [Bazantic — Best Recipe](https://ethglobal.com/events/ethonline2026/prizes#bazantic)        | Create a Bazantic account and gateway; combine Bazantic with another available sponsor service; make the result depend materially on both; record the complete flow; submit the account username. | Publish one Recipe that obtains a live 1inch mainnet route and makes Mandate independently decode and assess it; neither service alone can produce `PASS`.                      |
| [Bazantic — Agentify a new API](https://ethglobal.com/events/ethonline2026/prizes#bazantic) | Add an API not already available through Bazantic or another event sponsor, build its gateway and a reusable Recipe, and demonstrate it.                                                          | Publish Mandate Inspector as the new service and keep its policy semantics distinct from the sponsor 1inch route provider.                                                      |
| [ETHOnline 2026](https://ethglobal.com/events/ethonline2026)                                | Submission closes **13 September 2026 at 12:00 EDT**; submit to at most three partners and provide a short demo video.                                                                            | Target 1inch, ENS, and Bazantic. Keep the final video within the stricter two-to-four-minute sponsor guidance.                                                                  |

The repository began after hacking opened, and the participant reports direct ETHGlobal approval. The initial public commit is `d67bcdc32813db9d703a2b413592f70a935eda1e` at `2026-09-04T16:40:08Z`; continue with reviewable commits rather than one final-day dump.

## Tool and source pins

| Component              | Exact pin                                              | Evidence or purpose                                                                                                |
| ---------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Node.js                | `24.15.0`                                              | `.node-version`; active LTS line used for verification                                                             |
| pnpm                   | `10.33.2`                                              | root `packageManager`; used to install and run Task 1                                                              |
| TypeScript             | `5.9.3`                                                | strict domain compilation                                                                                          |
| Zod                    | `4.5.4`                                                | runtime validation and generated JSON Schema                                                                       |
| Vitest                 | `5.0.0`                                                | domain contract tests                                                                                              |
| Turbo                  | `2.10.12`                                              | workspace task graph                                                                                               |
| Prettier               | `3.9.6`                                                | deterministic formatting                                                                                           |
| ESLint                 | `10.10.0`                                              | first-party TypeScript linting                                                                                     |
| typescript-eslint      | `8.69.0`                                               | type-aware ESLint rules; `@eslint/js` pinned at `10.0.1`                                                           |
| Solidity               | `0.8.30`                                               | Aqua-compatible compiler pin in `contracts/foundry.toml`                                                           |
| Foundry                | `v1.8.1`                                               | selected Windows toolchain; release ZIP SHA-256 `02d98fc2c573793960ee06b7f642487d483fe30572f7e248804c207334a418d8` |
| Aqua                   | `81c26e4619ce21556ab02b3284ee2685de21fb18` (`v1.0.0`)  | official source submodule                                                                                          |
| ENSv2 contracts        | `97a57293f3b4279d94b571e678edb53ce62638f4`             | exact revision linked by the official Sepolia deployment page                                                      |
| OpenZeppelin Contracts | `c64a1edb67b6e3f4a15cca8909c9482ad33a02b0` (`v5.4.0`)  | SafeERC20 and audited primitives                                                                                   |
| 1inch solidity-utils   | `2d91bb67665467afc06907a69513b0fa66c46f0d` (`6.9.10`)  | pinned 1inch utility source                                                                                        |
| forge-std              | `8e40513d678f392f398620b3ef2b418648b33e89` (`v1.11.0`) | Foundry tests and scripts                                                                                          |

Dependencies are Git submodules rather than copied interfaces. The working machine did not yet have `forge`, `cast`, or `solc` on `PATH`; Foundry installation remains an explicit contract-work prerequisite.

## Sepolia runtime evidence

Official sources: [Aqua contract addresses](https://business.1inch.com/portal/documentation/aqua/reference/contract-addresses) and [ENS deployments](https://docs.ens.domains/learn/deployments#sepolia-ensv2-beta).

Probe transport was `https://ethereum-sepolia-rpc.publicnode.com`. JSON-RPC returned `eth_chainId = 0xaa36a7` (`11155111`). A first historical call was rejected because that public endpoint did not retain the requested state; all recorded code and interface probes were then bound to fresh block **11634993**, hash `0xfa6aa87d51040cc664902d6ff5a11b0c1917c0deb0e3ce48651f3655e33fb338`, timestamp `2026-09-04T17:48:36Z`.

| Contract               | Status                                                     | Address                                      | Runtime code hash                                                    | Interface proof                                                                   |
| ---------------------- | ---------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Aqua registry          | Official; enabled                                          | `0x1111113ccf1426a8e30e2bff5e005d929bf6a90a` | `0x720bc02d220db318164dc3bade86eec1f3655bdc00fc1174de7d816a95c341f8` | 5,619 code bytes; `owner()` returned `0x4134e66d52efc4c77dd8ccc952d87b9e92e0c352` |
| ENSv2 ETHRegistry      | Official; enabled                                          | `0xbdc85dd5b15d7ecb354cd7cb6f2c50b4f2c4f0e2` | `0x99a6ba74173ac220fd9d7a2000a8142cf52d98c7a17ac6abc6d74fa17d8f086c` | 14,730 code bytes; `getState(0)` returned the expected 160-byte zero state        |
| ENSv2 PublicResolverV2 | Official deployment; not selected as the strategy resolver | `0xe7b9a25607e02da8145e4eb1836ca539e53f11f7` | `0x15e1eca874f53a880df16f9a6646c978e400d3d58883ab28960a6050f8472d16` | 14,433 code bytes; `addr(bytes32(0))` returned the zero address                   |

`packages/contracts/src/deployments/sepolia.json` records the machine-readable evidence. Probe `resultHash` values are SHA-256 over raw ABI result bytes; runtime `codeHash` values are EVM account code hashes.

### Current Sepolia authority runtime

The kickoff rows above remain the provenance record for official dependencies. The current Mandate-owned runtime was verified at block [`11668681`](https://sepolia.etherscan.io/block/11668681), hash `0x2c893855f099ecdf5e9daad091863a1d6edbd57279cc7bb0a01dfcd6f1099aa7`:

- `MandateAquaApp`: [`0xFfDEfE2eBB164095b471e1F0B7EC492c8D26438F`](https://sepolia.etherscan.io/address/0xFfDEfE2eBB164095b471e1F0B7EC492c8D26438F), bound to official Sepolia Aqua;
- fixed test-only USDC-to-DAI venue: [`0x6690118e223948eE6dabF09e089247854bCcD369`](https://sepolia.etherscan.io/address/0x6690118e223948eE6dabF09e089247854bCcD369);
- venue input recipient: Privy smart wallet [`0xee637a2cf3aa61a29339532941b80b41ffea88c7`](https://sepolia.etherscan.io/address/0xee637a2cf3aa61a29339532941b80b41ffea88c7).

The venue is explicitly non-official and exists only for Sepolia integration proof. It does not replace the separate pinned-mainnet-fork proof against real 1inch liquidity.

## Kickoff gates and current disposition

- The current canonical SwapVM router `0x111111338c5091e8440b67b168bae16a668ac0de` has no Sepolia runtime code. Do not claim it as a Sepolia venue.
- 1inch Classic v6.1 does not advertise Sepolia. The safe proof topology is official ENSv2 + Aqua on Sepolia and the same Mandate settlement path against real 1inch liquidity on a pinned mainnet fork, with every test venue visibly labeled.
- `ONEINCH_API_KEY`, `BAZANTIC_API_KEY`, `SEPOLIA_RPC_URL`, and `SETTLEMENT_FORK_RPC_URL` were unavailable at kickoff. The current runtime now has separately verified Sepolia, pinned-fork, and public Bazantic surfaces. Paid Recipe proof remains blocked only on a funded Bazantic payment source; the unpaid dashboard test is not substituted.
- Bazantic account `Febri` owns the published Mandate and 1inch gateways plus Recipe `mandate-1inch-route-assurance`. Exact public identifiers, outcome hashes, and redacted captures are recorded in `docs/evidence/bazantic.md`.
- The account-specific Permissioned Resolver is now selected and recorded in the deployment manifest. The public resolver row remains dependency provenance, not strategy authority.
