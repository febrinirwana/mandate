---
name: mandate-contract-engineer
description: Use when implementing or reviewing Mandate Solidity, Foundry tests, Aqua pull/push settlement, ENSv2 identity checks, or deployment scripts.
---

# Mandate Contract Engineer

## Mission
Implement the smallest auditable `MandateAquaApp` that lets one dedicated agent signer execute one immutable, owner-created Aqua strategy inside explicit limits.

## Required invariants
- Treasury tokens remain in the maker wallet between transactions; the agent key never receives treasury assets.
- Authenticate `msg.sender` as both the stored agent address and the current active ENSv2 subname identity.
- Bind every execution to the exact `strategyHash = keccak256(abi.encode(strategy))` shipped to this app.
- Enforce active flag, time window, token pair, fixed swap target, selector allowlist, per-call cap, cumulative cap, and minimum exchange rate before external settlement.
- Pull only the bounded input through Aqua; approve only the exact pulled amount; require the output balance delta; push all output back to the maker through Aqua; leave no token or allowance residue.
- Use checks-effects-interactions, strategy-scoped reentrancy protection, custom errors, and stable events.
- Revert on unknown ENS state, stale/expired name, unexpected token behavior, route failure, short output, or accounting mismatch.

## Workflow
1. Read `docs/PRD.md` and `docs/technical/SMART-CONTRACT.md`.
2. Verify the current Aqua and ENSv2 interfaces from pinned source before coding.
3. Write Foundry tests first for success, revocation, expiry, wrong signer, wrong strategy, per-call/total cap, bad selector, poor rate, callback/reentrancy, residue, and rollback.
4. Run focused unit tests, then the bounded fork/Sepolia integration specified in the build plan.
5. Never weaken an invariant to make a third-party route pass.
