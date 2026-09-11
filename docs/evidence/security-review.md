# Task 12 security review

Review date: 2026-09-11

Reviewed candidate: `560588099ae2af4ad6f037615a4f9eb5a70a66b2`

Remediation checkpoint: `8540ac0`

## Scope

The review covered the authorization and settlement boundary in `contracts/src/MandateAquaApp.sol`, dedicated-agent policy and signing code under `apps/agent/src`, browser wallet call construction under `apps/web/src`, API request validation under `apps/api/src`, canonical chain reads under `packages/chain/src`, database connection safeguards under `packages/db/src`, deployment manifests, and the Task 12 release topology.

The review checked these release invariants:

- only the configured agent can execute a strategy;
- strategy target, selector, tokens, recipient, rate, cap, and time window remain immutable;
- live ENS registry, token owner, resolver, and address state are read at execution;
- Aqua pull, venue call, and Aqua push settle atomically with no app residue or residual allowance;
- unknown chain, simulation, or receipt state fails closed;
- browser code contains no owner or agent private key;
- a key-backed HTTP service is not exposed as a general transaction signer;
- owner approvals are bounded by the mandate;
- logs and API failures do not return configured secrets.

## Findings and remediation

### S-01 High: public demo execution was not pinned to one strategy

- Symbol: `createDemoExecutionService` in `apps/agent/src/demo.ts`
- Precondition: the demo endpoint is reachable and the dedicated agent has gas.
- Exploit path: an attacker creates another strategy with the public agent identity, token pair, and route profile, then submits its hash to the demo endpoint. The old service reconstructed any matching strategy from chain state and could spend the dedicated signer's gas executing it.
- Impact: unauthorized use of the release signer and unbounded gas consumption across attacker-created mandates. Token custody still remained with each strategy maker.
- Smallest fix: parse `AGENT_STRATEGY_HASH` into the demo runtime and reject every other hash before chain reads, simulation, or signer invocation.
- Status: fixed in `8540ac0`.
- Verification: the agent suite proves that an unapproved strategy hash returns `STRATEGY_HASH_MISMATCH` without invoking automated execution.

### S-02 High: browser issuance and approval restoration requested unlimited token allowance

- Symbols: `buildAuthorityCalls` in `apps/web/src/lib/privy-wallet.ts`; `buildOwnerControlCalls` in `apps/web/src/components/mandate/owner-controls.tsx`
- Precondition: the treasury owner signs the browser-generated approval call.
- Exploit path: the old call encoded `approve(AQUA, type(uint256).max)` even though the strategy carried a finite total cap.
- Impact: the token allowance granted to Aqua exceeded the authority represented by the mandate. Contract caps protected this Mandate app, but the wallet approval itself was not least privilege.
- Smallest fix: issuance approves exactly `maxInputTotal`; restoration approves exactly `maxInputTotal - usedInput`, clamped to zero.
- Status: fixed in `8540ac0`.
- Verification: web tests decode the submitted calldata and assert the exact total or remaining cap.

### S-03 Medium: the dedicated-agent server listened on every interface by default

- Symbol: `listenDemoExecutionServer` in `apps/agent/src/server.ts`
- Precondition: the host firewall or network makes the configured agent port reachable.
- Exploit path: Node's omitted host argument bound the key-backed service to the wildcard address.
- Impact: the signer service had a larger network exposure than the intended web-to-agent loopback topology.
- Smallest fix: bind to `127.0.0.1` by default and publish no agent port in the release topology.
- Status: fixed in `8540ac0`.
- Verification: the server suite inspects the bound address and requires `127.0.0.1`.

## Confirmed controls

- `MandateAquaApp.execute` recomputes the strategy hash, requires activation, checks revoke and time boundaries, requires the exact agent caller, and reads live ENS state.
- The contract checks both immutable and agent minimum output, exact input receipt and full spend, exact Aqua settlement, zero application residue, and zero temporary allowances.
- Contract tests cover wrong callers, cap boundaries, expiry, live ENS ownership and resolver failures, inactive Aqua state, fee-on-transfer and false-return tokens, partial-spend and wrong-recipient venues, reentrancy, failed push rollback, fuzzed caps and rates, and stateful invariants.
- `PreparedExecution` is opaque. The signer revalidates its policy, simulation binding, canonical block hash, account, target, calldata, and zero value immediately before submission.
- Agent error responses and logs expose only reason codes, stages, and opaque hashes.
- Non-loopback PostgreSQL URLs require `sslmode=require`.

## Residual findings and limits

### R-01 Low: Solidity label normalization is broader than the domain schema

`StrategyV1Schema` accepts an ASCII lowercase ENS label of at most 63 characters with no leading or trailing hyphen. The deployed contract rejects empty labels, dots, NUL bytes, and uppercase characters but accepts some additional byte strings. This does not bypass identity authorization because execution still requires a registered live label, current token ownership by the agent, the exact resolver pointer, and the exact resolved address. Changing the deployed source would require a new deployment and would invalidate the recorded source and bytecode evidence, so this remains documented rather than silently changing release semantics.

### R-02 Operational: public read and simulation routes consume RPC capacity

The public API validates schema, limits request bodies to 64 KiB, and applies a 10 second timeout. It does not implement identity authentication because inspection and preflight simulation are intentionally public. Production must expose only the documented routes through the reverse proxy, keep the database and agent ports private, and use provider and proxy controls appropriate to expected traffic.

### R-03 Scope limit

This is a focused release review, not an independent third-party audit. Vendored dependencies, the upstream Aqua and ENS implementations, wallet provider infrastructure, RPC provider internals, Supabase operations, and the VPS operating system are outside source-review scope except where their trust assumptions cross Mandate's interfaces. Live deployment and explorer evidence are verified separately in the Task 12 release record.
