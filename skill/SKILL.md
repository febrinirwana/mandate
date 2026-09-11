---
name: mandate-constrained-execution
description: Inspect, simulate, and execute one exact MandateAquaApp strategy through an isolated dedicated signer.
---

# Mandate constrained execution

Use this skill only to execute an already-issued `StrategyV1` through the configured `MandateAquaApp`. The signer holds gas only. Treasury assets remain in the maker wallet and Aqua allocation.

## Safety rules

1. Treat the current block-stamped Mandate, ENS, Aqua, token, and receipt reads as authority. Database and cached state are evidence only.
2. Accept only the typed execution intent below. The caller never supplies transaction destination, function selector, native value, raw transaction, or signing method.
3. Reconstruct `MandateAquaApp.execute(strategy, amountIn, agentMinOut, executionDeadline, routeData)` inside the preparation boundary. Derive `to` from configured Mandate app and force `value = 0`.
4. Independently require the configured chain, app, dedicated signer, exact strategy hash, supported token pair, fixed route target, fixed route selector, fixed recipient, per-call cap, remaining total cap, validity window, and deadline.
5. Use base-unit integer strings and `bigint` arithmetic only. Reject decimal or floating-point amounts.
6. Inspect live Mandate, ENS, and Aqua state before simulation. Inactive, revoked, expired, unregistered, mismatched, insufficient, or unavailable state fails closed.
7. Require `SimulationV1.result = PASS` for the exact chain, caller, app, strategy hash, calldata hash, block number, and block hash. Re-run the exact simulation against its canonical block and recheck block hash and `expiresAt` immediately before submission.
8. Treat `FAIL`, `UNKNOWN`, a changed input, stale evidence, a reorg, or an RPC/API outage as rejection. Never infer success.
9. Wait for the transaction receipt, require a canonical `ExecutionV1`, then run `ReceiptAuditV1`. Preserve `UNKNOWN` audit results; never relabel them compliant.
10. Never log or return a private key, mnemonic, keystore JSON, keystore password, account object, signed raw transaction, full environment, or unpublished intent.

## Accepted tool input

The decision tool accepts exactly this JSON shape. Unknown fields are rejected.

```json
{
  "chainId": "<positive decimal chain id>",
  "strategy": {
    "version": 1,
    "maker": "<address>",
    "agent": "<dedicated agent address>",
    "ensRegistry": "<address>",
    "ensResolver": "<address>",
    "ensLabel": "<normalized label>",
    "ensNode": "<bytes32>",
    "tokenIn": "<address>",
    "tokenOut": "<address>",
    "swapTarget": "<fixed venue address>",
    "swapSelector": "<bytes4>",
    "minRateNumerator": "<positive base-unit integer>",
    "minRateDenominator": "<positive base-unit integer>",
    "maxInputPerCall": "<positive base-unit integer>",
    "maxInputTotal": "<positive base-unit integer>",
    "validAfter": "<unix seconds>",
    "validUntil": "<unix seconds>",
    "salt": "<bytes32>"
  },
  "amountIn": "<positive base-unit integer>",
  "agentMinOut": "<base-unit integer>",
  "executionDeadline": "<unix seconds>",
  "routeData": "<fixed-route calldata>",
  "simulation": "<complete SimulationV1 from the typed simulation tool>"
}
```

Not accepted: `to`, `value`, `gas`, `nonce`, `data`, `rawTransaction`, `method`, or any signing payload.

## Tool outputs

Automated custody returns only confirmed chain evidence:

```json
{
  "mode": "AUTOMATED",
  "txHash": "<transaction hash>",
  "execution": "<canonical ExecutionV1>",
  "audit": "<ReceiptAuditV1; may be COMPLIANT, NON_COMPLIANT, or UNKNOWN>"
}
```

Manual custody returns one exact prepared request for the existing dedicated browser-wallet adapter:

```json
{
  "mode": "MANUAL",
  "request": {
    "chainId": "<configured chain id>",
    "account": "<configured dedicated agent>",
    "to": "<configured MandateAquaApp>",
    "data": "<internally reconstructed execute calldata>",
    "value": "0"
  }
}
```

A rejection returns a stable domain reason and no transaction:

```json
{
  "status": "REJECTED",
  "reason": "<ReasonCode>"
}
```

An unexpected unavailable dependency returns `UNKNOWN` plus an error hash, never raw error details that could contain secrets.

## Stable result and reason semantics

- `PASS`: exact simulation passed at the bound canonical block; advisory until the immediate freshness recheck and onchain execution.
- `FAIL`: a deterministic policy or chain check failed. Do not submit.
- `UNKNOWN`: required evidence was unavailable or noncanonical. Do not submit.
- `COMPLIANT`: canonical receipt audit proved every required postcondition.
- `NON_COMPLIANT`: canonical evidence proved at least one audit failure.

Use the existing `@mandate/domain` reason vocabulary. Runtime denials commonly include:

- Authority: `MANDATE_INACTIVE`, `MANDATE_REVOKED`, `MANDATE_NOT_STARTED`, `MANDATE_EXPIRED`, `CALLER_NOT_AGENT`.
- Identity: `ENS_NOT_REGISTERED`, `ENS_EXPIRED`, `ENS_OWNER_MISMATCH`, `ENS_ADDRESS_MISMATCH`, `ENS_READ_UNAVAILABLE`.
- Strategy/Aqua: `STRATEGY_HASH_MISMATCH`, `AQUA_STRATEGY_INACTIVE`, `AQUA_BALANCE_INSUFFICIENT`, `AQUA_READ_UNAVAILABLE`.
- Amount/route/time: `INVALID_AMOUNT`, `PER_CALL_CAP_EXCEEDED`, `TOTAL_CAP_EXCEEDED`, `TARGET_MISMATCH`, `SELECTOR_MISMATCH`, `EXECUTION_DEADLINE_EXPIRED`, `ROUTE_REVERTED`.
- Freshness/audit: `SIMULATION_STALE`, `RECEIPT_NOT_CANONICAL`.

Do not expose external revert strings as reason codes. Map deterministic Mandate custom errors to the stable domain code; otherwise fail closed.

## Freshness behavior

A simulation is usable only while all of these remain exact:

- `binding.chainId` equals configured chain;
- `binding.caller` equals decrypted dedicated signer;
- `binding.to` equals configured Mandate app;
- `binding.strategyHash` equals locally reconstructed and configured strategy hash;
- `binding.calldataHash` equals locally reconstructed execute calldata hash;
- `binding.blockHash` is still canonical for `binding.blockNumber`;
- current time is strictly before `binding.expiresAt`;
- a repeated exact simulation still returns the same PASS binding.

Any changed amount, minimum output, deadline, route data, strategy, caller, app, block, or live authority invalidates the evidence.

## Examples

Safe sequence:

1. Obtain the exact issued `StrategyV1` and current `SimulationV1` from typed Mandate boundaries.
2. Submit only the accepted intent fields.
3. Let the runtime inspect and repeat the exact simulation.
4. In automated mode, receive canonical receipt and audit evidence. In manual mode, review and approve the one prepared call in the dedicated agent browser wallet.
5. Treat the observed result as whatever the returned evidence states; never hard-code a successful outcome.

Rejected examples:

- Adding `to: <attacker>` or raw `data` -> `INVALID_STRATEGY`; unknown fields are not an escape hatch.
- Changing `strategy.swapTarget` -> `TARGET_MISMATCH`.
- Changing `strategy.swapSelector` -> `SELECTOR_MISMATCH`.
- Setting `amountIn` above the configured or strategy cap -> `PER_CALL_CAP_EXCEEDED` or `TOTAL_CAP_EXCEEDED`.
- Reusing an expired or mismatched simulation -> `SIMULATION_STALE`.
- Using a revoked identity or mandate -> `MANDATE_REVOKED` or the exact identity reason.
- Routing output to a different recipient -> `TARGET_MISMATCH`.
- Supplying unavailable evidence -> `UNKNOWN`/`ENS_READ_UNAVAILABLE`; no transaction.

## Manual mode

Manual mode is for environments where automated keystore custody is inappropriate. It passes through the same inspection, policy, exact simulation, canonical-block, and expiry checks. It then hands only the opaque prepared execution to `apps/web/src/lib/wallet.ts#submitPreparedExecution`, which requests the configured chain and dedicated agent account before showing the wallet confirmation. Manual mode does not use the treasury-owner wallet and does not create an arbitrary transaction console.

## Explicit non-capabilities

This runtime cannot:

- sign or submit a generic transaction;
- accept arbitrary destination, calldata, selector, or native value;
- call `sendRawTransaction`, `personal_sign`, `signMessage`, or arbitrary `signTypedData`;
- access the owner key or move owner assets outside the issued Mandate/Aqua strategy;
- create, mutate, discover, schedule, or autonomously select strategies;
- bypass simulation freshness, live ENS/Aqua reads, or canonical receipt audit;
- turn `UNKNOWN` into approval.

## Prevented submissions and final onchain boundary

The constrained runtime prevents wrong chain/app/caller, non-execute calls, nonzero native value, wrong strategy/hash/token pair, cap overflow, invalid window/deadline, stale or mismatched simulation, inactive/revoked/unknown authority, insufficient Aqua balance, wrong venue selector, wrong route amount, and wrong recipient before the dedicated signer is invoked.

A transaction constructed outside this runtime is still governed by `MandateAquaApp`. Its custom-error checks remain the final boundary for caller identity, activation/revocation/time, exact strategy hash, live ENS ownership/address, Aqua activation/balance, cumulative caps, route selector, minimum output, full input spend, cleared allowance, zero residue, and reentrancy. The runtime reduces signer capability; it does not replace the contract.
