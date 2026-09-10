# Judge-First Full Demo Design

**Goal:** Let any judge authenticate, create a funded Sepolia owner smart account, issue one understandable Mandate, trigger the constrained demo agent, and inspect canonical evidence without possessing the agent key or reading raw ABI values.

## Scope

This change redesigns `/issue` and `/mandates/<strategyHash>` around one judge-completable story. It also adds the minimum browser-to-agent boundary required to execute a newly issued demo mandate without exposing the agent key.

The design preserves the existing contract, `StrategyV1`, simulation, ENS, Aqua, receipt, and audit semantics. It does not add a generic transaction endpoint, allow arbitrary calldata, make each judge an ENS agent, or claim that Ethereum-mainnet 1inch evidence proves a Sepolia execution.

## Success criteria

A first-time judge can complete the primary path without documentation:

1. authenticate with email or an external EVM wallet;
2. receive a dedicated Privy smart account controlled by that authentication method;
3. obtain demo USDC and understand the available balance;
4. review human-readable defaults and activate one atomic four-call mandate;
5. land automatically on a comprehensible active-mandate control room;
6. trigger one bounded demo-agent execution;
7. observe live ENS, simulation, submission, canonical receipt, and audit states;
8. reload or share the receipt URL without losing the transaction context.

A disabled primary action always states the exact unmet prerequisite. No loading state can remain unbounded without a retry or recovery action.

## Identity and custody model

The interface must distinguish three roles:

- **Owner authentication:** the judge's email, social, or external EVM wallet used to authenticate with Privy.
- **Owner smart account:** a dedicated ERC-4337 account controlled by Privy's embedded signer. This address is the dynamic `StrategyV1.maker`, holds demo assets, and atomically submits the four issuance calls.
- **Named agent:** the fixed dedicated executor address resolved by `agent.mandate-test.eth`. The agent address and ENS identity are shared infrastructure; they do not change when a different judge issues a mandate.

`PrivyProvider` uses `embeddedWallets.ethereum.createOnLogin = "all-users"`. An external wallet may authenticate the owner, but its EOA address is not presented as the mandate maker. The UI explicitly shows “Signed in with …” separately from “Owner smart account …”. This preserves atomic batching and gas sponsorship across login methods.

A judge does not need an ENS name or the agent private key. Creating user-specific agent names is outside scope.

## Performance architecture

The root layout remains server-first and must not import Privy. Wallet dependencies are scoped to wallet actions:

- `/issue` loads the Privy issuance island because wallet interaction is the page's primary purpose.
- `/mandates/<strategyHash>` renders inspection without Privy. It lazy-loads a Privy owner-control island only after the user selects “Manage authority”.
- the landing page and read-only inspector do not download Privy or smart-wallet code.

No new UI or state-management dependency is added. Existing React, Next, Tailwind, viem, and Privy APIs are sufficient.

Performance is assessed with production navigation, not development compilation. The implementation must record production `/`, `/issue`, and active inspector load timings and transferred JavaScript before and after the change. Development mode remains a correctness tool, not the performance claim.

## Issuance experience

### Page structure

`/issue` becomes a focused four-stage workspace rather than four equally weighted bordered cards:

1. **Connect owner**
2. **Fund demo account**
3. **Set authority limits**
4. **Review and activate**

A sticky progress rail shows `CURRENT`, `COMPLETE`, or `NEEDS ACTION` for every stage. Completed stages remain reviewable. Only the current stage receives the primary visual emphasis.

The existing reviewable-authority card is retained and improved. It stays visible on desktop, follows the active stage, and summarizes changes immediately.

### Smart-wallet lifecycle

The owner stage exposes finite states:

- `SIGNED_OUT`
- `AUTHENTICATING`
- `PREPARING_ACCOUNT`
- `READY`
- `RECOVERABLE_ERROR`

`PREPARING_ACCOUNT` explains that Privy is creating a dedicated owner smart account and that onchain deployment occurs with the first transaction. After a bounded wait, the state becomes `RECOVERABLE_ERROR` with retry and sign-out actions. It never remains “Preparing smart wallet…” indefinitely.

When ready, the stage shows authentication identity, shortened smart-account address, copy control, Sepolia network, and gas-sponsorship status without implying that the external EOA is the maker.

### Demo funding

Funding displays current human-unit balance and the required maximum spend side by side. Submission, inclusion, and refreshed balance are separate states. The primary action states the consequence, for example “Add 100 demo USDC”.

If the configured balance is below the draft cap, the flow offers either another faucet mint or a one-click reduction to the available balance. Demo tokens are visibly labeled test-only.

### Authority defaults and validation

The form starts with safe demo defaults:

- maximum spend: `1` USDC;
- minimum output rate: `1` DAI per USDC;
- expiry: 24 hours from the current local time.

Each field has helper text and inline validation. Validation preserves the existing compiler invariants and surfaces their exact human-readable cause: positive amount, positive decimal rate, future expiry, and contract duration limit.

The review summary leads with:

> `agent.mandate-test.eth` may convert up to 1 USDC to DAI, never below 1 DAI/USDC, until <local date>.

Raw addresses, selector, salt, base-unit ratios, and encoded strategy are available only inside “Technical strategy evidence”.

### Activation readiness

The activation panel lists every prerequisite and its current status:

- owner smart account ready;
- live Sepolia contracts ready;
- ENS agent identity registered and matching;
- demo balance covers the cap;
- economic fields valid;
- exact four-call batch ready.

The activation button is disabled only when at least one visible checklist item is not complete. Submission has explicit preparing, wallet-confirmation, submitted, canonical-confirmation, rejection, and failure states.

After canonical activation, the app navigates to:

`/mandates/<strategyHash>?justIssued=1`

The `justIssued` flag activates a concise success introduction; it is not evidence and never changes protocol state.

## Inspector experience

### Information architecture

The inspector becomes an “Authority control room” with a short primary path and progressive disclosure.

Above the fold shows:

- current authority state;
- human sentence describing agent, pair, cap, rate, and expiry;
- named ENS agent and resolved address;
- owner smart account;
- remaining budget with human token units;
- primary “Run 1 USDC demo execution” action when eligible;
- secondary “Manage authority” action for the owner.

A compact sticky section navigation links to Overview, Agent run, Evidence, and Safety. Raw hashes remain copyable but do not dominate headings or breadcrumbs.

### Agent run timeline

The primary Sepolia execution timeline is:

1. **Read authority** — current block-stamped Mandate and Aqua state;
2. **Verify ENS agent** — live registry, owner, resolver, and resolved-address agreement;
3. **Simulate exact call** — exact strategy, amount, minimum output, route, deadline, and canonical block binding;
4. **Constrained execution** — dedicated server-side agent signs only the internally reconstructed `MandateAquaApp.execute` call;
5. **Canonical evidence** — receipt confirmation, worker/index evidence, and compliance audit.

Every step reports `WAITING`, `RUNNING`, `PASS`, `FAIL`, or `UNKNOWN`. `FAIL` and `UNKNOWN` stop the sequence and show a stable reason. The UI never upgrades an unavailable dependency into success.

After submission, the inspector updates its URL to include `tx=<transactionHash>`. On direct load or refresh, that query parameter restores receipt and audit loading. `justIssued=1` may remain or be removed without affecting evidence.

### Owner controls

“Manage authority” lazy-loads Privy. The control verifies that the loaded smart account equals `snapshot.strategy.maker` before enabling revoke or Aqua dock actions. Owner actions use the same smart-wallet client as issuance rather than the injected EOA provider.

The ENS stop path remains an explanatory external action because the fixed agent identity is controlled by the project agent operator, not by each mandate owner.

### Human and technical evidence

Primary panels format token amounts with their configured decimals and timestamps in local time while preserving exact values in accessible labels or technical disclosure.

The page groups evidence into:

- **What is allowed** — cap, rate, pair, time, route;
- **Where funds are** — owner physical balance versus Aqua virtual allocation;
- **What happened** — execution movement and canonical receipt;
- **Why it is trusted** — ENS, simulation binding, receipt audit, block and evidence hashes;
- **How to stop it** — revoke, dock, or invalidate agent identity.

The complete `StrategyV1`, raw base units, addresses, calldata, selectors, and hashes live in one “Technical evidence” disclosure rather than across the primary flow.

## Browser-to-agent boundary

A separate agent HTTP process, not `apps/api` or Next.js, owns automated signing. This preserves the existing rule that the public data API cannot sign.

The browser-facing operation accepts only:

- chain ID;
- activated strategy hash;
- requested demo amount selected from a server-defined bounded option.

It does not accept destination, native value, calldata, selector, route target, signer, raw transaction, or simulation result.

The agent process:

1. reads the activated strategy from chain;
2. requires the configured demo chain, fixed agent, ENS profile, token pair, route target, and selector;
3. derives an amount no greater than 1 demo USDC, the per-call cap, and remaining total cap;
4. constructs the fixed Sepolia venue calldata and execution deadline internally;
5. requests the exact simulation;
6. invokes the existing constrained runtime, which repeats live checks and simulation freshness before signing;
7. returns only the transaction hash, canonical execution, audit, and stable safe error state.

This endpoint is enabled only in explicit demo mode and only for the configured mintable demo-token profile. Contract checks remain the final boundary. The signer secret and keystore never enter the API, web process, browser, response, or logs.

## Bazantic inside the inspector

Bazantic is visible in the inspector under “Machine economy”, but it is not falsely represented as a prerequisite for the Sepolia transaction.

The existing published Recipe proves a separate Ethereum-mainnet route-policy assurance flow:

1. obtain a live 1inch Classic route;
2. pass the unmodified provider response to Mandate Inspector;
3. return deterministic `PASS`, `FAIL`, or `UNKNOWN` plus evidence hashes.

The inspector presents two complementary lanes:

- **Sepolia authority execution:** ENS → simulation → constrained execution → canonical receipt audit.
- **Ethereum mainnet route assurance:** Bazantic Recipe → live 1inch route → Mandate policy assessment → x402 evidence.

The chain labels are always visible. The UI explicitly states that mainnet route evidence does not prove the Sepolia receipt.

The Bazantic panel renders the checked-in public proof immediately: Recipe handle/ID, result, evidence hashes, two paid ingredient settlement references, and the fact that the Recipe-level response had `paid: null`. A live Recipe rerun may be offered only when the public upstream is reachable; failure is `UNKNOWN` and never replaces the recorded proof.

## Failure and recovery behavior

- Privy unavailable: finite error with retry/sign-out; no disabled dead end.
- Smart account missing: explain provisioning requirement; retry creation/session.
- Readiness unavailable: show affected dependency and retry; no transaction preparation.
- Invalid field: attach the precise message to the field and readiness checklist.
- Faucet rejected/reverted: preserve every form value and allow retry.
- Activation rejected/reverted: preserve reviewed strategy and completed steps.
- Agent service unavailable: show `UNKNOWN`; keep the active mandate inspectable and owner controls available.
- Simulation stale: return to simulation step and rerun exact inputs.
- Receipt pending: show submitted transaction and continue bounded polling.
- Receipt missing/reorged: never display compliant.
- Bazantic unavailable: recorded public proof remains labeled historical; live status is `UNKNOWN`.

## Testing and verification

Permanent tests cover only durable behavior:

- explicit issuance readiness reasons and valid default strategy;
- all-user Privy configuration and finite smart-account recovery state;
- canonical activation navigation with strategy hash;
- inspector query-driven receipt restoration;
- owner smart-account equality before stop actions;
- strict demo-agent request schema rejecting arbitrary transaction fields;
- demo-agent dynamic strategy policy retaining fixed signer/token/route boundaries;
- fail-closed execution state transitions;
- honest Bazantic/Sepolia chain labeling;
- keyboard access, mobile width, and reduced motion.

The final proof uses production builds and actual surfaces:

1. load landing, issuance, and inspector while recording timings and JavaScript transfer;
2. authenticate a fresh user;
3. wait for a visible ready smart account;
4. fund, accept defaults, and activate the four-call batch;
5. verify automatic strategy-hash navigation;
6. run the demo agent and observe canonical receipt/audit;
7. reload the transaction URL and recover the evidence;
8. open owner controls from the issuing account and verify authorization;
9. verify read-only inspector and Bazantic evidence on desktop and 375 px width.

## Judging narrative

The four-minute demonstration should spend less than 20 seconds on context and then show:

1. any judge login creates a dedicated owner account;
2. one sentence defines the economic boundary;
3. one atomic owner approval activates it;
4. the named ENS agent executes without taking custody;
5. the inspector proves movement, compliance, and independent stop paths;
6. Bazantic shows the complementary paid machine-to-machine 1inch route-assurance proof.

The interface optimizes for technicality, originality, practicality, usability, and WOW without weakening fail-closed semantics or overstating cross-chain evidence.
