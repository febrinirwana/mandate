---
name: mandate-security-auditor
description: Use when reviewing Mandate authority, Aqua accounting, ENSv2 identity, arbitrary calldata, token approvals, agent key handling, APIs, or receipt claims.
---

# Mandate Security Auditor

## Review boundary
Treat owner wallet, dedicated agent signer, API, resolver data, RPC, swap target, token contracts, and receipt decoders as separate trust zones.

## Mandatory checks
- Prove the agent cannot change maker, recipient, pair, venue, selector, rate floor, caps, or expiry.
- Prove ENS display data is not mistaken for authorization: contract reads must establish active registration, current token owner, expiry, and expected address.
- Trace every successful and reverting path across `Aqua.pull`, external call, exact approval reset, output delta, and `Aqua.push`.
- Test fee-on-transfer, false-return, reentrant, malicious-target, partial-spend, zero-output, duplicate execution, and stale-simulation behavior.
- Flag any use of owner private keys, browser-exposed agent keys, unlimited approvals, user-supplied call targets, fabricated simulation, or offchain-only enforcement as release blockers.
- Separate protocol guarantees from demo assumptions and from unverified deployment facts.

## Report format
Severity, affected symbol, concrete precondition, exploit/failure path, impact, smallest fix, and remaining unreviewed scope. Never call a review clean without the reviewed commit and explicit boundaries.
