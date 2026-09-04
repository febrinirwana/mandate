# Mandate Smart-Contract Specification

## 1. Contract decision

MVP deploys one non-upgradeable `MandateAquaApp`. It is a narrow exact-input executor, not a generic router. It binds one Aqua strategy hash to one treasury maker, one dedicated agent, one live ENSv2 identity, one pair, one venue target/selector, one rate floor, caps, and a time window.

The owner retains assets in its wallet between executions. The agent calls the contract using its own EOA and gas. No owner signature is required per execution because the owner already shipped the immutable Aqua strategy and activated the matching mandate.

## 2. External interfaces

Import the pinned official interfaces rather than maintaining guessed local copies:

```solidity
import {IAqua} from "@1inch/aqua/src/interfaces/IAqua.sol";
import {IPermissionedRegistry} from
    "@ensdomains/contracts-v2/registry/interfaces/IPermissionedRegistry.sol";

interface IAddrResolver {
    function addr(bytes32 node) external view returns (address);
}
```

The current `IPermissionedRegistry` source defines:

```solidity
enum Status {
    AVAILABLE,
    RESERVED,
    REGISTERED
}

struct State {
    Status status;
    uint64 expiry;
    address latestOwner;
    uint256 tokenId;
    uint256 resource;
}

function getState(uint256 anyId) external view returns (State memory state);
function ownerOf(uint256 tokenId) external view returns (address owner);
```

Execution derives `labelId = uint256(keccak256(bytes(ensLabel)))`, calls `getState(labelId)`, requires `REGISTERED`, checks the returned expiry and current `ownerOf(state.tokenId)`, requires `registry.getResolver(ensLabel)` to equal the pinned resolver, then checks `IAddrResolver(ensResolver).addr(ensNode)`. The exact import remapping and revision must match the selected ENSv2 deployment.

## 3. Immutable contract configuration

```solidity
IAqua public immutable AQUA;
uint64 public immutable MAX_MANDATE_DURATION;
```

Constructor rejects zero Aqua and an unreasonable/zero maximum duration. No owner/admin, upgrade, rescue-to-admin, or mutable target registry exists in MVP. If token residue is impossible to recover safely without an admin, successful execution must enforce zero/baseline residue; accidental direct transfers are explicitly unsupported rather than adding a broad rescue key.

## 4. Strategy and state

```solidity
struct Strategy {
    address maker;
    address agent;
    address ensRegistry;
    address ensResolver;
    string ensLabel;
    bytes32 ensNode;
    address tokenIn;
    address tokenOut;
    address swapTarget;
    bytes4 swapSelector;
    uint256 minRateNumerator;
    uint256 minRateDenominator;
    uint256 maxInputPerCall;
    uint256 maxInputTotal;
    uint64 validAfter;
    uint64 validUntil;
    bytes32 salt;
}

struct MandateState {
    address maker;
    uint256 usedInput;
    bool activated;
    bool revoked;
}

mapping(bytes32 => MandateState) public mandates;
```

`strategyHash(strategy) = keccak256(abi.encode(strategy))` exactly. Frontend, TypeScript, Foundry, and Aqua `Shipped` event must agree on the bytes and hash.

## 5. Public interface

```solidity
function strategyHash(Strategy calldata strategy) external pure returns (bytes32);
function minimumOutput(Strategy calldata strategy, uint256 amountIn) external pure returns (uint256);
function activate(Strategy calldata strategy) external;
function revoke(bytes32 strategyHash) external;
function inspect(Strategy calldata strategy) external view returns (Inspection memory);
function execute(
    Strategy calldata strategy,
    uint256 amountIn,
    uint256 agentMinOut,
    uint64 executionDeadline,
    bytes calldata routeData
) external returns (uint256 amountOut);
```

`inspect` is convenience only. Execution does not trust an earlier inspection result.

## 6. Strategy validation

`activate` and `execute` share validation:

1. maker, agent, registry, resolver, tokens, target nonzero;
2. tokens distinct;
3. selector nonzero and `routeData.length >= 4` during execution;
4. rate numerator and denominator nonzero;
5. caps nonzero and `maxInputPerCall <= maxInputTotal`;
6. `validUntil > validAfter`;
7. duration at most `MAX_MANDATE_DURATION`;
8. `ensNode` is nonzero and `ensLabel` is a nonempty normalized subname label without a dot;
9. strategy hash not previously activated during activation;
10. Aqua reports both strategy tokens active for maker/app/hash.

Do not accept full ENS names, symbols, decimals, target arrays, or dynamic policy blobs onchain.

## 7. Activation

Only `strategy.maker` can activate. Activation:

1. validates immutable fields;
2. computes hash;
3. reads Aqua `safeBalances(maker, address(this), hash, tokenIn, tokenOut)`;
4. records maker, zero used input, activated true, revoked false;
5. emits all policy-critical values or emits hash plus the exact ABI-encoded strategy bytes so indexers can reconstruct them.

Calling activation twice for the same hash reverts. Activation does not move tokens and does not alter Aqua allocation.

## 8. Live ENS authorization

Execution reads all of the following from the strategy's fixed contracts:

1. derive `labelId = uint256(keccak256(bytes(strategy.ensLabel)))`;
2. `state = registry.getState(labelId)` and require `state.status == IPermissionedRegistry.Status.REGISTERED`;
3. require `state.expiry > block.timestamp`;
4. require `registry.ownerOf(state.tokenId) == strategy.agent`;
5. require `registry.getResolver(strategy.ensLabel) == strategy.ensResolver`;
6. require `IAddrResolver(strategy.ensResolver).addr(strategy.ensNode) == strategy.agent`;
7. require `msg.sender == strategy.agent`.

The app uses the current token ID returned inside `State`; ENSv2 token IDs are versioned and can become stale after role or registration changes. Verifying the registry's current resolver pointer prevents an old detached resolver record from continuing to authorize the agent.

If the selected ENS deployment separates the name's registry/resolver hierarchy differently, the integration adapter must prove the equivalent checks and the strategy must still pin every contract/node used. No offchain universal resolver answer authorizes execution.

## 9. Execution preconditions

In order:

1. no native `msg.value`;
2. strategy hash matches active state maker;
3. activated and not revoked;
4. current time at/after `validAfter` and before `validUntil`;
5. `executionDeadline >= block.timestamp`;
6. caller and live ENS checks pass;
7. `amountIn > 0`;
8. `amountIn <= maxInputPerCall`;
9. `usedInput + amountIn <= maxInputTotal` without unchecked overflow;
10. first four bytes of `routeData` equal `swapSelector`;
11. Aqua input virtual balance at least `amountIn` and both tokens active;
12. computed immutable minimum output and `agentMinOut` are valid.

State usage increments before external interaction. Any later revert rolls it back.

## 10. Settlement algorithm

Let baseline balances be the app's `tokenIn` and `tokenOut` balances before pull.

1. `AQUA.pull(maker, hash, tokenIn, amountIn, address(this))`.
2. Require tokenIn balance increased by exactly `amountIn`; rejects fee-on-transfer input.
3. Force-approve `swapTarget` for exactly `amountIn`.
4. Call fixed target using `routeData`; do not forward native value.
5. Force-approve target to zero whether the target consumed the allowance; a revert rolls back anyway.
6. Require tokenIn returned to its pre-pull baseline. Partial-spend/refund semantics are unsupported in MVP.
7. Compute `amountOut = tokenOutBalanceAfter - tokenOutBaseline`; underflow or zero reverts.
8. Compute rate floor with overflow-safe `mulDiv` rounding up and require `amountOut >= max(floor, agentMinOut)`.
9. Force-approve Aqua for exactly `amountOut`.
10. `AQUA.push(maker, address(this), hash, tokenOut, amountOut)`.
11. Force-approve Aqua to zero if the token/library does not guarantee allowance consumption.
12. Require app token balances equal baselines and both target/Aqua output allowances are zero.
13. Emit actual amounts and `usedInput`.

Baseline rather than absolute zero prevents an attacker from griefing execution by directly transferring dust to the app. The contract neither attributes nor rescues unrelated dust.

## 11. Rate arithmetic

`minimumOutput = ceil(amountIn * numerator / denominator)` using a full-precision multiplication/division primitive. Reject a zero result if policy semantics require positive output. Foundry fuzzing covers maximum values, exact divisibility, one-unit rounding, and denominator edge cases.

The ratio is expressed in base units. The UI converts human values using verified token decimals before encoding. Contract never calls token metadata for policy arithmetic.

## 12. Revocation

`revoke(hash)` requires `msg.sender == mandates[hash].maker`, activated true, and revoked false. It sets revoked true and emits `MandateRevoked`. Revocation is irreversible for that hash.

Revocation does not call Aqua dock. This avoids a coupled external call and gives the owner independent stop paths. UI offers a separate dock transaction. A new policy uses a new salt/hash.

## 13. Events

```solidity
event MandateActivated(
    bytes32 indexed strategyHash,
    address indexed maker,
    address indexed agent,
    bytes strategy
);

event MandateExecuted(
    bytes32 indexed strategyHash,
    address indexed maker,
    address indexed agent,
    uint256 amountIn,
    uint256 amountOut,
    uint256 usedInputAfter
);

event MandateRevoked(
    bytes32 indexed strategyHash,
    address indexed maker
);
```

If gas forces omitting `strategy` bytes from activation, indexers must cite Aqua's `Shipped` event. Do not omit policy provenance without an alternative onchain source.

## 14. Custom errors

At minimum:

`InvalidStrategy`, `AlreadyActivated`, `NotMaker`, `NotAgent`, `MandateInactive`, `MandateRevokedError`, `NotStarted`, `Expired`, `ExecutionDeadlineExpired`, `ENSNotRegistered`, `ENSExpired`, `ENSOwnerMismatch`, `ENSAddressMismatch`, `AquaStrategyInactive`, `AquaBalanceInsufficient`, `ZeroAmount`, `PerCallCapExceeded`, `TotalCapExceeded`, `WrongSelector`, `RouteCallFailed`, `InputTransferMismatch`, `InputNotFullySpent`, `OutputTooLow`, `ResidualBalance`, `ResidualAllowance`.

API maps selectors to stable reason codes; raw external revert data is attached as bounded diagnostic bytes/hash.

## 15. Reentrancy and external-call rules

- Strategy-scoped transient/storage lock covers all execution state and external calls.
- No callback entry may activate, revoke, or execute the same strategy while locked.
- A different strategy cannot exist in MVP demo assumptions, but contract tests decide whether cross-strategy reentrancy is safe; simplest safe implementation uses a global lock if no measured concurrency need.
- Checks-effects-interactions and atomic revert are required but not substitutes for the lock.
- External target is fixed in strategy; selector is fixed; native value is zero; approval is exact.
- Never `delegatecall`.

## 16. Security properties

A passing test suite must demonstrate:

1. agent cannot redirect output;
2. agent cannot change token pair, target, selector, rate, caps, maker, identity, or window;
3. wrong/cached/expired/revoked ENS state fails;
4. Aqua inactive/docked/insufficient state fails;
5. per-call and cumulative limits hold at exact boundaries under fuzzing;
6. venue cannot retain approval after success;
7. short output, partial input spend, token fee, callback, and failed push roll back use accounting and all movements;
8. direct token dust does not become stealable or permanently disable baseline-safe execution;
9. revoke is one-way and owner-only;
10. no state-changing function has hidden admin behavior.

## 17. Test matrix

### Unit

Strategy validation, hashing, activation, all ENS checks, time edges, caps, rate rounding, selector extraction, event fields, revocation.

### Adversarial fixtures

False-return token, fee-on-transfer input, rebasing-like balance mutation, reentrant token, malicious target, target returning success without output, partial spender, wrong-recipient target, output callback, reverting Aqua push.

### Invariant/stateful fuzz

- `usedInput <= maxInputTotal`;
- revoked never becomes active;
- only maker balance receives successful output;
- app's attributable balances/allowances return to baseline after success;
- failed calls do not change mandate use or Aqua balances;
- every `MandateExecuted` corresponds to Aqua pull and push for the same maker/hash/tokens.

### Integration

1. Official/pinned Aqua source under local Anvil.
2. Current ENSv2 Sepolia registry/resolver with registered subname.
3. Selected real venue on testnet or pinned supported-chain fork.
4. Full owner setup, agent execution, owner revoke, repeated agent failure.

## 18. Deployment and verification

- Build reproducibly from a pinned commit.
- Deploy constructor with recorded Aqua address and duration.
- Verify source and compiler settings on explorer.
- Record chain ID, deployment tx, address, runtime bytecode hash, Aqua address/code hash, ENS addresses/code hashes, and venue target/code hash.
- Transfer no admin because contract has none.
- Execute canary with deliberately small caps before demo allocation.

## 19. Known limitations

- Fixed rate floor becomes stale; owner must revoke/dock and ship a new strategy.
- Exact-input full-spend excludes some routers/tokens.
- ENS and Aqua availability are chain-specific.
- A compromised agent can consume remaining allowed budget at the worst still-permitted rate.
- A malicious owner can issue unsafe policy; Mandate enforces owner intent, not financial prudence.
- Contract is unaudited hackathon software until independent review states otherwise.
