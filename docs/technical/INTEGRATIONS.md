# Mandate Integration Specification

**Rule:** no integration is enabled by name alone. Each deployment is admitted by chain ID, address, code hash, pinned interface/source revision, successful probe, and verification date.

## 1. Integration map

| Integration | Load-bearing contribution | Trust boundary | MVP proof |
|---|---|---|---|
| 1inch Aqua | wallet-custodied virtual allocation and app-only pull/push | Aqua accounting/source/deployment | ship, active balances, bounded pull, output push, dock |
| ENSv2 | live agent identity, ownership, expiry, revocation | registry/resolver deployment and state | Sepolia register, resolve, execute, revoke/expire, fail |
| Fixed swap venue | actual exact-input conversion | venue code/liquidity/calldata | fixed target+selector, exact spend, output delta, revert |
| 1inch API/trace | route or transaction evidence | API availability/auth/chain support | one recorded live response tied to demo transaction |
| Bazantic | paid machine-to-machine audit workflow | account, gateway, service/Recipe semantics | paid Recipe calls both Mandate and 1inch services |
| RPC provider | block-tagged calls, simulation, receipts | completeness, reorg, rate limits | multi-call/read probes and canonical receipt |
| ERC-20s | physical balances and approvals | non-standard token behavior | admission suite and code hash |

## 2. 1inch Aqua

### Verified source behavior

From current official `IAqua`/`Aqua.sol`:

- virtual balance key: maker, app, strategy hash, token;
- `ship` hashes full strategy bytes and initializes all listed token balances;
- existing strategy entries are immutable;
- `dock` must close every token and marks the strategy docked;
- `pull` is keyed by `msg.sender` as app, decrements virtual balance, then transfers from maker;
- `push` transfers from caller to maker and increments an active app strategy balance;
- `safeBalances` reverts when queried tokens are not active;
- Aqua does not implement route pricing or protect a faulty app.

Primary sources: [repository](https://github.com/1inch/aqua), [IAqua](https://github.com/1inch/aqua/blob/main/src/interfaces/IAqua.sol), [Aqua](https://github.com/1inch/aqua/blob/main/src/Aqua.sol), [AquaApp](https://github.com/1inch/aqua/blob/main/src/AquaApp.sol), [XYCSwap example](https://github.com/1inch/aqua/blob/main/examples/apps/XYCSwap.sol).

### Setup

1. verify contract deployment or deploy pinned source;
2. maker approves Aqua for both strategy tokens according to tested token semantics;
3. maker calls `ship(MandateAquaApp, abi.encode(strategy), [tokenIn, tokenOut], [maxInputTotal, 0])`;
4. compare returned/emitted hash to local/app hash;
5. activate app mandate;
6. read `rawBalances` for both tokens and record tokens count.

The initial output balance of zero is not absence: the token must be listed at ship time so later `push` remains valid.

### Runtime checks

- app address in Aqua key equals deployed Mandate app;
- raw/safe balances are active, not docked;
- input allocation covers amount;
- post-execution input virtual decrease equals pulled input;
- output virtual increase equals pushed output;
- physical maker deltas and app event agree.

### Open verification gates

- Exact official deployment addresses and supported test networks at kickoff.
- Source/package revision compatible with Solidity 0.8.30.
- Whether sponsor judges accept self-deployed Aqua on Sepolia; ask sponsor before submission if no official deployment exists.
- ERC-20 allowance requirements for selected tokens.

Do not fill these from memory.

## 3. SwapVM and route choice

SwapVM is an optional settlement candidate, not a required abstraction. Official source shows Aqua orders use `safeBalances`, perform VM instructions, pull maker output, and push taker input; existing deployments are listed in its README. Mandate's treasury-conversion flow differs because one authorized agent instructs the app to convert maker inventory and return proceeds to the same maker.

Integration decision at kickoff:

1. probe a direct supported exact-input venue/1inch route where Mandate app can be output recipient;
2. if SwapVM can satisfy fixed-target/selector, exact input, recipient, and residue invariants, use it;
3. otherwise use the smallest verified 1inch-compatible aggregation target;
4. never weaken Mandate invariants to fit a router.

Primary source: [SwapVM repository](https://github.com/1inch/swap-vm).

### Venue admission record

```json
{
  "chainId": "...",
  "target": "0x...",
  "codeHash": "0x...",
  "selector": "0x........",
  "exactInput": true,
  "outputRecipient": "MANDATE_APP",
  "fullInputConsumption": true,
  "nativeValue": "0",
  "verifiedAtBlock": "...",
  "verifiedAtHash": "0x...",
  "source": "official URL or explorer"
}
```

Ellipses are schema illustration only; admission file rejects them.

## 4. ENSv2

### Verified source behavior

ENSv2 Permissioned Registry:

- represents registered names as ERC-1155 singleton tokens;
- stores expiry, resolver, and subregistry pointers;
- uses Enhanced Access Control;
- exposes `getStatus`, `getExpiry`, `getTokenId`, and `ownerOf`;
- returns zero ownership for expired/stale token IDs;
- may change token IDs after role/registration changes.

Permissioned Resolver is per-account and exposes address records. EAC roles are contract/resource-specific; Mandate does not invent an ENS `EXECUTE` role or reinterpret an unrelated role.

Primary sources: [overview](https://docs.ens.domains/ensv2/overview), [registry](https://docs.ens.domains/ensv2/permissioned-registry), [resolver](https://docs.ens.domains/ensv2/permissioned-resolver), [EAC](https://docs.ens.domains/ensv2/enhanced-access-control), [contract tutorial](https://docs.ens.domains/ensv2/tutorial-contract-developers/).

### Setup path

1. use the official Sepolia ENSv2 deployment required by the current track;
2. owner-controlled parent/subregistry registers one agent label with finite expiry;
3. current token owner is the dedicated agent EOA or exact sponsor-recommended equivalent;
4. resolver's Ethereum address record for the full node equals the same EOA;
5. owner retains a documented parent registrar/admin path to unregister, expire, or change the binding;
6. strategy pins registry, normalized subname label, full-name node, expected resolver, and agent address.

### Execution reads

Derive the label ID from the stored label, call `getState(labelId)`, verify the current token owner, require `getResolver(label)` to equal the pinned resolver, then read `addr(node)` from that resolver. Use one block context offchain where feasible; the contract performs direct reads inside execution. API cannot substitute a Universal Resolver cache for contract checks.

### Gates

- exact Sepolia deployment addresses and official ABI;
- concrete registration transaction sequence for owned parent;
- status enum value/type;
- resolver hierarchy for selected name;
- sponsor confirmation of the clearest revocation proof.

## 5. 1inch APIs

Mandate may use:

- route/quote service to obtain calldata for the fixed admitted venue;
- Web3 RPC to supplement provider redundancy;
- transaction trace service for receipt audit.

The official 1inch AI skill bundle describes Aqua analytics and authenticated `product_api` access, but skills are usage guidance, not proof of chain/endpoint availability. At kickoff, call the live API, record request ID, response schema, chain support, latency, terms, and attribution requirements.

Security:

- API key server-only;
- allow only configured chain/pair/target/selector;
- validate calldata destination and selector after response;
- never execute API response without onchain strategy enforcement;
- quote freshness is separate from simulation freshness.

## 6. Bazantic

### Product contribution

Mandate adds a service Bazantic does not already provide:

`GET /v1/receipts/{chainId}/{txHash}/audit`

It answers: “Did this transaction execute the exact active mandate, identity, caps, Aqua movements, route, and recipient?”

A Bazantic Recipe combines:

1. a live 1inch transaction trace/data call;
2. the Mandate Inspector paid endpoint;
3. deterministic merge logic keyed by chain and transaction hash.

Neither service alone produces the final audit: 1inch supplies execution trace/context; Mandate supplies strategy/ENS/cap/Aqua semantics.

### Response

```json
{
  "version": 1,
  "result": "COMPLIANT",
  "chainId": "...",
  "txHash": "0x...",
  "block": { "number": "...", "hash": "0x..." },
  "strategyHash": "0x...",
  "checks": [],
  "evidence": [
    { "provider": "1inch", "responseHash": "0x..." },
    { "provider": "mandate", "responseHash": "0x..." }
  ]
}
```

Result values are `COMPLIANT`, `NON_COMPLIANT`, `UNKNOWN`. A paid response is not automatically compliant.

### Qualification gates

- create Bazantic account before event cutoff;
- confirm x402/MPP Gateway and Recipe schema from current docs;
- verify Mandate service is new and not a thin proxy of an existing API;
- make both services materially determine the final result;
- record a screen capture from paid request through final response;
- include attribution/username required by current submission rules.

## 7. RPC providers

Required capabilities:

- `eth_call` with explicit `from` and block tag;
- `eth_estimateGas`;
- receipt and block-by-hash;
- logs by bounded range;
- archival state for execution-block audit where promised;
- chain ID verification and rate-limit visibility.

Use two providers only if the second gives measured reliability. Never compare unpinned latest reads and call that consensus.

## 8. Token admission

For each token:

1. verify chain/address/code;
2. read decimals and symbol for display only;
3. test maker-to-app `transferFrom` through Aqua;
4. test exact approve to target and reset to zero;
5. test app-to-maker push through Aqua;
6. reject transfer fees, rebasing during tx, callback behavior, or non-standard balance deltas unless explicitly supported;
7. record maximum demo amount and faucet/liquidity provenance.

## 9. Deployment manifest

Each environment has a checked-in, non-secret manifest containing:

- environment and chain ID;
- Aqua address, source revision, official/self-deployed flag, code hash;
- Mandate app address, deployment tx, code hash;
- ENS registry/resolver addresses and code hashes;
- token addresses/decimals/code hashes;
- venue target/selector/code hash;
- verification block number/hash/time;
- explorer/source links;
- completed probe names.

No address enters production code as an unexplained constant.

## 10. Integration failure register

| Risk | Detection | Release response |
|---|---|---|
| no compatible Aqua on Sepolia | official docs/source + `eth_getCode` | self-deploy pinned source, label honestly, confirm prize eligibility |
| no real venue on Sepolia | exact-input probe fails | split Sepolia identity and pinned-fork settlement proofs |
| ENS ABI/deployment changes | compile/runtime probe fails | update adapter/spec from official source; do not shim guessed ABI |
| token leaves residue | admission test | replace token/route or explicitly model refund; no invariant bypass |
| 1inch endpoint unavailable | live probe | use only verified alternative contribution; update claims |
| Bazantic service not considered new | sponsor feedback | narrow Inspector to unique mandate semantics; do not proxy |
| archival receipt state unavailable | block-tagged read fails | audit `UNKNOWN` or switch verified provider |
| chain reorg | receipt block hash changes | invalidate and rebuild audit after confirmations |

## 11. Source and claim discipline

A README/submission claim uses one of: verified source citation, deployed bytecode/transaction, passing test output, or recorded UI behavior. Product copy must distinguish official deployment, self-deployed source, local fixture, and pinned fork. Reverify all track terms at submission because the event has not begun at this research cut-off.
