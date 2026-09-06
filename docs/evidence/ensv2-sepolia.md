# ENSv2 Sepolia Evidence

## Status

**Public-chain proof is blocked, not claimed.** This branch contains source-backed ENSv2 integration code and local tests, but it has not registered an identity, deployed Mandate, or executed against Sepolia in this session.

The existing [`sepolia.json`](../../packages/contracts/src/deployments/sepolia.json) records historical/preliminary contract observations. Before it can authorize a public deployment, re-check every retained address and runtime code hash at one canonical Sepolia block with `verifyContractCodeAtBlock`; do not treat its `official` fields or historical timestamps as a substitute for that probe.

## Source-backed topology

| Component                    | Address                                      | Role                                                                                                  |
| ---------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| ENSv2 `ETHRegistry`          | `0xbdc85dd5b15d7ecb354cd7cb6f2c50b4f2c4f0e2` | Parent Permissioned Registry for the agent label                                                      |
| ENSv2 `PublicResolverV2`     | `0xe7b9a25607e02da8145e4eb1836ca539e53f11f7` | Official public resolver deployment; deliberately disabled in the manifest and not identity authority |
| ENSv2 `PermissionedResolver` | Per-account proxy, selected during setup     | Registry-pinned resolver whose `addr(node)` must equal the agent                                      |

ENSv2 sources are pinned to [`97a57293f3b4279d94b571e678edb53ce62638f4`](https://github.com/ensdomains/contracts-v2/tree/97a57293f3b4279d94b571e678edb53ce62638f4). `MandateAquaApp` uses that source's `IPermissionedRegistry`; it verifies label state, finite expiry, current token ownership, registry resolver pointer, and the resolver address record live on every execution.

## Prepared deployment and authority model

- `DeploySepolia.s.sol` deploys pinned Aqua source (`81c26e4619ce21556ab02b3284ee2685de21fb18`) and `MandateAquaApp` only on chain ID `11155111`. It does not claim an unverified external Aqua address.
- `SetupEnsIdentity.s.sol` accepts a normalized ASCII immediate label and selected parent node, derives the child node locally, registers it with a finite expiry, pins the registry resolver, then sets `addr(node)` to the dedicated agent. It re-reads every identity component after the transaction.
- The treasury broadcaster must hold the parent registry's registrar and unregister authority and must be permitted to set the chosen resolver address record. The agent receives the identity token with role bitmap zero; it needs gas only.
- `StopEnsIdentity.s.sol` calls the owner-controlled `unregister(labelId)` path and verifies the label is no longer registered. The next identical Mandate execution must then revert through the existing live identity guard.

## Deterministic probes

`packages/chain/src/ens.ts` reads the following fields at one requested block and rejects a changing canonical header:

1. `getState(labelId)` for registration status and expiry.
2. `ownerOf(state.tokenId)` for the current token owner.
3. `getResolver(labelId)` for the registry-selected resolver.
4. `addr(namehash(name))` against that selected resolver for the resolved agent address.

The same module's `verifyContractCodeAtBlock` confirms an address's runtime code hash and re-checks the block hash by number and by hash. The reader never substitutes `PublicResolverV2` for an identity's resolver pointer.

## Required public evidence

The remaining gate needs these non-secret inputs configured on the execution host:

1. `SEPOLIA_RPC_URL`.
2. An owner-controlled Permissioned Registry address, normalized immediate label, and selected parent node.
3. Public treasury and dedicated-agent addresses plus Foundry `--account` aliases or keystore configuration. Do not provide raw private keys; fund the agent with gas only.

With those inputs, record the selected canonical block, code hashes, deployment and setup transaction links, deployed Aqua and Mandate addresses, active permit transaction/receipt, stop transaction/receipt, and the subsequent expected identity-denial transaction/receipt. Until then, there are no public transaction links, deployed app address, agent name, or stop-denial proof to cite.
