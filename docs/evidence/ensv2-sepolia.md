# ENSv2 Sepolia Evidence

## Status

**Fresh public authority runtime active.** The treasury re-registered `agent.mandate-test.eth`, and the current registry owner, selected resolver, and resolved address all point to the dedicated agent. A fresh Mandate app and fixed Sepolia USDC-to-DAI venue were then deployed for the Privy smart-wallet flow.

The earlier end-to-end execution/revocation proof remains preserved below as historical evidence. Its app and strategy are retired and are not the configured runtime.

## Current public identity and deployment

| Component                            | Value                                                                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| ENS namespace controller             | [`0xf48DBc49B23669e8B08fC6c08e0aB61cf7301466`](https://sepolia.etherscan.io/address/0xf48DBc49B23669e8B08fC6c08e0aB61cf7301466) |
| Privy wallet / venue input recipient | [`0xee637a2cf3aa61a29339532941b80b41ffea88c7`](https://sepolia.etherscan.io/address/0xee637a2cf3aa61a29339532941b80b41ffea88c7) |
| Dedicated agent                      | [`0x77606352f523f8a076498aB8BeFF3af3BC1e492A`](https://sepolia.etherscan.io/address/0x77606352f523f8a076498aB8BeFF3af3BC1e492A) |
| ENSv2 name                           | `agent.mandate-test.eth`                                                                                                        |
| ENS node                             | `0x38487fa23703342a9da685adffe972546c61377db5e07135a27fadf646e14e64`                                                            |
| Permissioned Registry                | [`0xb15cBA2d8B5FF4C26C001D39cd026a00DCD94DEe`](https://sepolia.etherscan.io/address/0xb15cBA2d8B5FF4C26C001D39cd026a00DCD94DEe) |
| Identity resolver                    | [`0x088A0B6Bcf7B1983d2d419786304C78068FB3161`](https://sepolia.etherscan.io/address/0x088A0B6Bcf7B1983d2d419786304C78068FB3161) |
| MandateAquaApp                       | [`0xFfDEfE2eBB164095b471e1F0B7EC492c8D26438F`](https://sepolia.etherscan.io/address/0xFfDEfE2eBB164095b471e1F0B7EC492c8D26438F) |
| Fixed USDC-to-DAI venue              | [`0x6690118e223948eE6dabF09e089247854bCcD369`](https://sepolia.etherscan.io/address/0x6690118e223948eE6dabF09e089247854bCcD369) |
| Official Sepolia Aqua                | [`0x1111113CCf1426A8E30e2bfF5E005d929bF6a90a`](https://sepolia.etherscan.io/address/0x1111113CCf1426A8E30e2bfF5E005d929bF6a90a) |

## Fresh runtime transaction evidence

| Step                                    |                                                     Block | Transaction                                                                                                                                                                |
| --------------------------------------- | --------------------------------------------------------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Re-register `agent` identity            | [`11668593`](https://sepolia.etherscan.io/block/11668593) | [`0x4ecba0fc36082943262bc8b3dd430ffd1065f5b962db72e2d635700f596dc37c`](https://sepolia.etherscan.io/tx/0x4ecba0fc36082943262bc8b3dd430ffd1065f5b962db72e2d635700f596dc37c) |
| Bind resolver address to agent          | [`11668594`](https://sepolia.etherscan.io/block/11668594) | [`0x1e7bac1cd073833fe22d90c8a7887f5f69ab3991701f996ef4acea9876c4839f`](https://sepolia.etherscan.io/tx/0x1e7bac1cd073833fe22d90c8a7887f5f69ab3991701f996ef4acea9876c4839f) |
| Deploy fresh MandateAquaApp             | [`11668678`](https://sepolia.etherscan.io/block/11668678) | [`0x0e3759ce72441de56684d002afbbcc19606812bb674a14db169ad781f268e9ee`](https://sepolia.etherscan.io/tx/0x0e3759ce72441de56684d002afbbcc19606812bb674a14db169ad781f268e9ee) |
| Deploy fixed USDC-to-DAI venue          | [`11668679`](https://sepolia.etherscan.io/block/11668679) | [`0x6c4842fd83c77abee2866c82f705b9b315269f0f21d99d5d8000b0ecec8e5d7f`](https://sepolia.etherscan.io/tx/0x6c4842fd83c77abee2866c82f705b9b315269f0f21d99d5d8000b0ecec8e5d7f) |
| Fund venue with test-only DAI liquidity | [`11668681`](https://sepolia.etherscan.io/block/11668681) | [`0xc4b542be1f0ea1e42207ae3ba5e64bc9e928590efbd47c12427c3eb95379dcf2`](https://sepolia.etherscan.io/tx/0xc4b542be1f0ea1e42207ae3ba5e64bc9e928590efbd47c12427c3eb95379dcf2) |
| Authorize 10 USDC StrategyV1 batch      | [`11668951`](https://sepolia.etherscan.io/block/11668951) | [`0x5e84e213bc79c97c7fef995b3206a92d1dd87a5509a026ac46448e65e83a1767`](https://sepolia.etherscan.io/tx/0x5e84e213bc79c97c7fef995b3206a92d1dd87a5509a026ac46448e65e83a1767) |

## Retired lifecycle proof

| Step                                 |                                                     Block | Transaction                                                                                                                                                                |
| ------------------------------------ | --------------------------------------------------------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repair standard ENSv2 identity state | [`11648593`](https://sepolia.etherscan.io/block/11648593) | [`0xf78f68b79e11c1faa4e0a4245c9e022323c86d6d89495c4c052334c0b155d876`](https://sepolia.etherscan.io/tx/0xf78f68b79e11c1faa4e0a4245c9e022323c86d6d89495c4c052334c0b155d876) |
| Clear legacy namehash state          | [`11648593`](https://sepolia.etherscan.io/block/11648593) | [`0x7111d604172666053d52242fcabcb40014cec2da2f1fc5d8ec1b3012a98bda4b`](https://sepolia.etherscan.io/tx/0x7111d604172666053d52242fcabcb40014cec2da2f1fc5d8ec1b3012a98bda4b) |
| Deploy retired MandateAquaApp        | [`11648628`](https://sepolia.etherscan.io/block/11648628) | [`0x1b07dce63c9bfd03eebbcb04affbbe4e7b9bad10bcd0913fdb5416dbfe67becc`](https://sepolia.etherscan.io/tx/0x1b07dce63c9bfd03eebbcb04affbbe4e7b9bad10bcd0913fdb5416dbfe67becc) |
| Activate bounded strategy            | [`11648735`](https://sepolia.etherscan.io/block/11648735) | [`0x46465aff7971c7b4b3121598769745fecf1d8db2ae66775f527180e21425f489`](https://sepolia.etherscan.io/tx/0x46465aff7971c7b4b3121598769745fecf1d8db2ae66775f527180e21425f489) |
| Execute 10 test USDC → 10 test DAI   | [`11648741`](https://sepolia.etherscan.io/block/11648741) | [`0x0e9ad62080a578346eef814e7a0a1ad09d2c647c779bff2e32ecf393d3b62f5f`](https://sepolia.etherscan.io/tx/0x0e9ad62080a578346eef814e7a0a1ad09d2c647c779bff2e32ecf393d3b62f5f) |
| Treasury unregisters `agent` label   | [`11651775`](https://sepolia.etherscan.io/block/11651775) | [`0x77c940dae0c33040dd6260f616725b19b09af022816948662bd3ef456c2b3377`](https://sepolia.etherscan.io/tx/0x77c940dae0c33040dd6260f616725b19b09af022816948662bd3ef456c2b3377) |
| Agent denial probe, reverted         | [`11651791`](https://sepolia.etherscan.io/block/11651791) | [`0x6185e78ad5d793165b7d139c96b40f1e50e9edb2e7c68d70b16a76a3212989bb`](https://sepolia.etherscan.io/tx/0x6185e78ad5d793165b7d139c96b40f1e50e9edb2e7c68d70b16a76a3212989bb) |

## Settlement and stop semantics

The retired strategy capped each call at 10 test USDC and total input at 100 test USDC. Its successful agent execution consumed `10_000_000` raw USDC units and produced `10_000_000_000_000_000_000` raw DAI units; the strategy inspection and Aqua raw balances were checked at block `11648741`.

`StopEnsIdentity.s.sol` used the treasury's registry-level `unregister(labelId)` authority. The agent has no owner or registrar authority.

`BuildSepoliaStopProbe.s.sol` builds a zero-input `MandateAquaApp.execute` call. `execute` validates the caller's live ENSv2 identity before its zero-amount guard, so no token pull, approval, route call, or Aqua state mutation can occur. The submitted call was sent by the dedicated agent to the deployed app with an explicit gas limit:

- receipt status: `0` (reverted);
- sender: the dedicated agent;
- destination: `MandateAquaApp`;
- replay at that canonical block returns `0x6940c9e0` = `ENSNotRegistered()`.

This proves that treasury removal of the ENSv2 label immediately denies Mandate execution at the contract guard, rather than merely preventing a later swap.

## Runtime binding

`DeploySepolia.s.sol` binds the current `MandateAquaApp` at `0xFfDEfE2eBB164095b471e1F0B7EC492c8D26438F` to official Sepolia Aqua `0x1111113CCf1426A8E30e2bfF5E005d929bF6a90a` after checking its pinned runtime hash. The fixed venue at `0x6690118e223948eE6dabF09e089247854bCcD369` binds USDC, DAI, the Privy input recipient, and selector `0x6d9a640a`. `MandateAquaApp` reads `IPermissionedRegistry.getState`, current token ownership, registry resolver selection, and resolver `addr(node)` on every call. The exact code hashes and raw ABI probe hashes are recorded in `packages/contracts/src/deployments/sepolia.json` at block `11668681`.

The first Privy/Alchemy-sponsored owner flow activated strategy `0x2152a8e88212e9a23bd37f0ee63f6a7fb234327708237a20f247ce5e329b02cf`. A subsequent canonical API read returned `activated = true`, `revoked = false`, `result = PASS`, and an exact Aqua input balance of `10000000` raw USDC units. The owner smart wallet held zero Sepolia ETH before sponsorship; the browser submitted the faucet and four-call authorization batches without an owner-funded gas prerequisite.

ENSv2 sources are pinned to [`97a57293f3b4279d94b571e678edb53ce62638f4`](https://github.com/ensdomains/contracts-v2/tree/97a57293f3b4279d94b571e678edb53ce62638f4). No private key, keystore password, or RPC URL is recorded here.
