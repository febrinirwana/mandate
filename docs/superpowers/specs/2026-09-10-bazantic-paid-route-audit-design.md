# Bazantic Paid Route Audit Design

**Goal:** Publish Mandate Inspector as a reusable paid Bazantic service and one Recipe whose final route-safety decision requires both a live 1inch Classic Swap response and Mandate's independent policy checks.

## Scope

Task 11 adds a deterministic pre-execution 1inch route assessment to the existing Mandate API, exposes the API through a Bazantic x402/MPP gateway, and publishes one Recipe that calls 1inch and Mandate Inspector in sequence. The existing block-bound Sepolia receipt audit remains available as a second Mandate gateway operation.

This task does not deploy Mandate to Ethereum mainnet, submit real-value swaps, add Uniswap, build a custom MCP server, or imply that a mainnet 1inch response proves a Sepolia receipt. Bazantic generates the MCP surface from OpenAPI.

## Product flow

The Recipe accepts one complete immutable `StrategyV1`, the Mandate app address, exact input, agent minimum output, execution deadline, and explicit 1inch routing parameters. It then:

1. calls the live 1inch Classic Swap v6.1 service for Ethereum mainnet;
2. passes the unmodified provider response and request metadata to Mandate Inspector;
3. returns only Mandate Inspector's `PASS`, `FAIL`, or `UNKNOWN` assessment and evidence bindings.

A `PASS` requires the response to decode as the admitted 1inch v6.1 function and agree with the policy on chain, router, selector, caller, recipient, tokens, exact amount, caps, rate floor, deadline, zero native value, and disabled partial fill. 1inch supplies the executable route; Mandate supplies the authorization and safety semantics. Neither alone can produce the Recipe result.

## Chain-boundary honesty

The public Mandate execution proof is Sepolia while the existing verified 1inch route is Ethereum mainnet. 1inch Traces does not currently provide the Sepolia trace needed to bind both services to one Sepolia transaction. The Recipe is therefore a mainnet route-policy assurance flow, not a receipt consensus claim.

The existing `GET /v1/receipts/{chainId}/{txHash}/audit` continues to prove canonical Sepolia execution, ENS, cap, Aqua, allowance, residue, and balance facts. Documentation and demo copy must present the Sepolia receipt proof and mainnet 1inch route proof as separate, complementary evidence.

## Public contracts

`@mandate/domain` owns strict schemas for:

- `OneInchRouteEvidenceV1`: an `AVAILABLE` response with request metadata and the exact provider payload, or an `UNAVAILABLE` observation with one bounded reason;
- `RouteAssessmentRequestV1`: version, chain `1`, Mandate app, immutable strategy, exact input, agent minimum output, execution deadline, expected protocols, and provider evidence;
- `RouteAssessmentV1`: result, stable reasons, strategy hash, normalized route when available, deterministic checks, and evidence hashes.

The response shape is:

```text
version, result, reasons, chainId, strategyHash
request: mandateApp, amountIn, agentMinOut, executionDeadline
route: provider, requestId, target, selector, executor, caller, recipient,
       tokenIn, tokenOut, amountIn, quotedAmountOut, routeMinimumOut,
       nativeValue, allowPartialFill, protocols; null when unavailable/invalid
checks[]: code, PASS|FAIL|UNKNOWN, optional safe detail
evidence[]: provider, responseHash
```

Hashes bind the normalized provider payload and Mandate assessment inputs. They never include API keys, authorization headers, RPC URLs, database URLs, signed raw transactions, or wallet material.

## Decision semantics

- `PASS`: provider is available and valid; every route and policy check passes.
- `FAIL`: parsed provider data contradicts an exact policy/request binding or violates a deterministic safety rule.
- `UNKNOWN`: the provider is unavailable, times out, or returns a payload that cannot be safely interpreted.

`FAIL` outranks `UNKNOWN`; otherwise any unknown check prevents `PASS`. Provider presence alone never creates a positive result.

Stable route reasons distinguish provider unavailability/invalidity from target, selector, caller, recipient, token, amount, cap, rate-floor, deadline, and route-minimum disagreement. User-controlled or upstream exception text is never returned.

## Implementation boundaries

- `packages/domain/src/index.ts` defines and exports the wire contract and generated JSON schema.
- `packages/chain/src/route.ts` retains request construction and exact 1inch calldata admission, adding typed admission failures only where the assessor needs stable semantics.
- `packages/chain/src/assessment.ts` is a pure, deterministic policy assessor. It performs no network request and reads no environment variables.
- `apps/api/src/app.ts` validates and documents `POST /v1/routes/1inch/assess`.
- `apps/api/src/services.ts` delegates to the pure assessor; controllers contain no policy arithmetic.
- `integrations/bazantic` contains the minimal 1inch OpenAPI description, Recipe payload, public fixtures, and exact gateway/test/capture instructions.

No custom payment, MCP, retry, cache, queue, or generic proxy layer is added. Bazantic owns payment and MCP; 1inch authentication remains server-side in its Bazantic gateway.

## Bazantic publication

Create two gateway ingredients:

1. Mandate Inspector, using the deployed Mandate API `/openapi.json`, priced at the smallest practical test amount.
2. 1inch Classic Swap v6.1, using a narrow checked-in OpenAPI document and server-side bearer authentication.

Publish one Recipe with exactly one `{{inputs}}` placeholder. The prompt must call 1inch first, pass its exact output into Mandate Inspector, preserve `UNKNOWN`, and never infer `PASS`. The published definition and fixtures contain public identifiers only.

The Recipe targets both Bazantic sub-prizes where the submission UI permits. Mandate Inspector qualifies as the new non-sponsor API; 1inch is the sponsor contribution. There is no claim that entering both guarantees both awards.

## Proof and failure cases

Permanent tests cover:

1. strict schemas and JSON Schema exposure;
2. a valid admitted route yielding `PASS`;
3. wrong target/selector/caller/recipient/token/amount yielding `FAIL`;
4. per-call cap, rate floor, route minimum, and deadline disagreement yielding `FAIL`;
5. unavailable and malformed provider evidence yielding `UNKNOWN`;
6. OpenAPI exposure and bounded/redacted API errors.

Completion additionally requires a live public backend smoke test, Bazantic gateway activation, a paid Recipe execution, recorded non-secret gateway/Recipe/request/payment/evidence identifiers, and a redacted screen capture. Secrets are inspected only as injected credentials and are never printed or committed.
