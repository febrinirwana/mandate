# ENSv2 Sepolia Evidence

## Status

**Complete public-chain proof.** A treasury-controlled ENSv2 identity authorized one bounded Mandate/Aqua execution, then the treasury unregistered that identity. The same agent's subsequent on-chain call reverted because the live ENSv2 registry state was no longer registered.

The denial is independently reproducible at canonical block [`11651791`](https://sepolia.etherscan.io/block/11651791): an `eth_call` from the dedicated agent using the submitted calldata returns `0x6940c9e0`, the selector for `MandateAquaApp.ENSNotRegistered()`.

## Public identity and deployment

| Component                 | Value                                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Treasury / strategy maker | [`0xf48DBc49B23669e8B08fC6c08e0aB61cf7301466`](https://sepolia.etherscan.io/address/0xf48DBc49B23669e8B08fC6c08e0aB61cf7301466) |
| Dedicated agent           | [`0x77606352f523f8a076498aB8BeFF3af3BC1e492A`](https://sepolia.etherscan.io/address/0x77606352f523f8a076498aB8BeFF3af3BC1e492A) |
| ENSv2 name                | `agent.mandate-test.eth`                                                                                                        |
| ENS node                  | `0x38487fa23703342a9da685adffe972546c61377db5e07135a27fadf646e14e64`                                                            |
| Permissioned Registry     | [`0xb15cBA2d8B5FF4C26C001D39cd026a00DCD94DEe`](https://sepolia.etherscan.io/address/0xb15cBA2d8B5FF4C26C001D39cd026a00DCD94DEe) |
| Identity resolver         | [`0x88a0B6bCf7b1983d2D419786304c78068fb31610`](https://sepolia.etherscan.io/address/0x88a0B6bCf7b1983d2D419786304c78068fb31610) |
| MandateAquaApp            | [`0x34bd1a513858f33c8929b93E892725F80c106576`](https://sepolia.etherscan.io/address/0x34bd1a513858f33c8929b93E892725F80c106576) |
| Official Sepolia Aqua     | [`0x1111113CCf1426A8E30e2bfF5E005d929bF6a90a`](https://sepolia.etherscan.io/address/0x1111113CCf1426A8E30e2bfF5E005d929bF6a90a) |
| Strategy hash             | `0xeb1763618d66f22f3575a1516fffbe0db1107e9ec6825780a1f50f6df6c8cede`                                                            |

## Transaction evidence

| Step                                        |                                                     Block | Transaction                                                                                                                                                                |
| ------------------------------------------- | --------------------------------------------------------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repair standard ENSv2 identity state        | [`11648593`](https://sepolia.etherscan.io/block/11648593) | [`0xf78f68b79e11c1faa4e0a4245c9e022323c86d6d89495c4c052334c0b155d876`](https://sepolia.etherscan.io/tx/0xf78f68b79e11c1faa4e0a4245c9e022323c86d6d89495c4c052334c0b155d876) |
| Clear legacy namehash state                 | [`11648593`](https://sepolia.etherscan.io/block/11648593) | [`0x7111d604172666053d52242fcabcb40014cec2da2f1fc5d8ec1b3012a98bda4b`](https://sepolia.etherscan.io/tx/0x7111d604172666053d52242fcabcb40014cec2da2f1fc5d8ec1b3012a98bda4b) |
| Deploy MandateAquaApp against official Aqua | [`11648628`](https://sepolia.etherscan.io/block/11648628) | [`0x1b07dce63c9bfd03eebbcb04affbbe4e7b9bad10bcd0913fdb5416dbfe67becc`](https://sepolia.etherscan.io/tx/0x1b07dce63c9bfd03eebbcb04affbbe4e7b9bad10bcd0913fdb5416dbfe67becc) |
| Activate bounded strategy                   | [`11648735`](https://sepolia.etherscan.io/block/11648735) | [`0x46465aff7971c7b4b3121598769745fecf1d8db2ae66775f527180e21425f489`](https://sepolia.etherscan.io/tx/0x46465aff7971c7b4b3121598769745fecf1d8db2ae66775f527180e21425f489) |
| Execute 10 MockUSDC → 10 MockDAI            | [`11648741`](https://sepolia.etherscan.io/block/11648741) | [`0x0e9ad62080a578346eef814e7a0a1ad09d2c647c779bff2e32ecf393d3b62f5f`](https://sepolia.etherscan.io/tx/0x0e9ad62080a578346eef814e7a0a1ad09d2c647c779bff2e32ecf393d3b62f5f) |
| Treasury unregisters `agent` label          | [`11651775`](https://sepolia.etherscan.io/block/11651775) | [`0x77c940dae0c33040dd6260f616725b19b09af022816948662bd3ef456c2b3377`](https://sepolia.etherscan.io/tx/0x77c940dae0c33040dd6260f616725b19b09af022816948662bd3ef456c2b3377) |
| Agent denial probe, reverted                | [`11651791`](https://sepolia.etherscan.io/block/11651791) | [`0x6185e78ad5d793165b7d139c96b40f1e50e9edb2e7c68d70b16a76a3212989bb`](https://sepolia.etherscan.io/tx/0x6185e78ad5d793165b7d139c96b40f1e50e9edb2e7c68d70b16a76a3212989bb) |

## Settlement and stop semantics

The activated strategy capped each call at 10 MockUSDC and total input at 100 MockUSDC. The successful agent execution consumed `10_000_000` raw MockUSDC units and produced `10_000_000_000_000_000_000` raw MockDAI units; the strategy inspection and Aqua raw balances were checked at block `11648741`.

`StopEnsIdentity.s.sol` used the treasury's registry-level `unregister(labelId)` authority. The agent has no owner or registrar authority.

`BuildSepoliaStopProbe.s.sol` builds a zero-input `MandateAquaApp.execute` call. `execute` validates the caller's live ENSv2 identity before its zero-amount guard, so no token pull, approval, route call, or Aqua state mutation can occur. The submitted call was sent by the dedicated agent to the deployed app with an explicit gas limit:

- receipt status: `0` (reverted);
- sender: the dedicated agent;
- destination: `MandateAquaApp`;
- replay at that canonical block returns `0x6940c9e0` = `ENSNotRegistered()`.

This proves that treasury removal of the ENSv2 label immediately denies Mandate execution at the contract guard, rather than merely preventing a later swap.

## Runtime binding

`DeploySepolia.s.sol` binds `MandateAquaApp` to the official Sepolia Aqua at `0x1111113CCf1426A8E30e2bfF5E005d929bF6a90a` after checking its pinned runtime hash. `MandateAquaApp` reads `IPermissionedRegistry.getState`, current token ownership, registry resolver selection, and resolver `addr(node)` on every call.

ENSv2 sources are pinned to [`97a57293f3b4279d94b571e678edb53ce62638f4`](https://github.com/ensdomains/contracts-v2/tree/97a57293f3b4279d94b571e678edb53ce62638f4). No private key, keystore password, or RPC URL is recorded here.
