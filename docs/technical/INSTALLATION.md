# Mandate Installation and Bootstrap Contract

This repository contains the runnable Mandate protocol demo, web application, API, confirmation worker, and dedicated constrained-agent service.

## 1. Required tools

- Git
- Node.js `>=24.15.0 <25` (matching the root `engines` contract)
- Corepack and project-pinned pnpm
- Foundry: `forge`, `cast`, `anvil`
- Docker Desktop/Engine for local PostgreSQL
- A browser wallet for the treasury owner
- A separate dedicated EOA or isolated signer keystore for the agent

Verify:

```bash
node --version
corepack --version
pnpm --version
forge --version
cast --version
anvil --version
docker --version
```

Exact supported versions are pinned in the first event-time scaffold commit; do not preselect floating dependency versions in CI.

## 2. Repository bootstrap

Implement [BUILD-PLAN](../BUILD-PLAN.md) Task 1. Target commands after scaffold:

```bash
corepack enable
pnpm install --frozen-lockfile
forge install
pnpm typecheck
forge build
```

Foundry dependencies must be pinned to commit hashes, including Aqua and ENSv2 contracts. Never use an unpinned branch in CI or deployment.

## 3. Environment contract

Create the ignored root `.env` from `.env.example`. For a local PostgreSQL run, set:

```dotenv
DATABASE_URL=postgresql://mandate:mandate@127.0.0.1:55432/mandate?sslmode=disable
DATABASE_MIGRATION_URL=postgresql://mandate:mandate@127.0.0.1:55432/mandate?sslmode=disable
SEPOLIA_RPC_URL=https://...
SEPOLIA_MANDATE_APP=0xffdefe2ebb164095b471e1f0b7ec492c8d26438f
SEPOLIA_MANDATE_DEPLOYMENT_BLOCK=11668678
SEPOLIA_VENUE_INPUT_RECIPIENT=0xee637a2cf3aa61a29339532941b80b41ffea88c7
ONEINCH_API_KEY=...
BAZANTIC_API_KEY=...
API_PORT=3001
MANDATE_AGENT_ORIGIN=http://127.0.0.1:3002
MANDATE_AGENT_AUTH_TOKEN=...
MANDATE_DEMO_AGENT_ENABLED=true
AGENT_PORT=3002
AGENT_HOST=127.0.0.1
AGENT_AUTH_TOKEN=...
WORKER_CONFIRMATION_DEPTH=4
WORKER_BATCH_SIZE=25
WORKER_POLL_INTERVAL_MS=15000
```

For the Next.js authority composer, create the ignored `apps/web/.env.local` with `MANDATE_CHAIN_ID=11155111`, the same `SEPOLIA_MANDATE_APP`, `MANDATE_API_ORIGIN`, `MANDATE_AGENT_ORIGIN=http://127.0.0.1:3002`, `NEXT_PUBLIC_PRIVY_APP_ID`, and `MANDATE_SEPOLIA_FAUCET_AMOUNT=100`. Copy the checked-in `MANDATE_POLICY_PROFILE` from `.env.example`; it is a single-line JSON object generated from block-stamped reads of the agent identity, token metadata, and fixed route. Local loopback operation does not require an agent token. A network deployment must set one identical high-entropy value as `AGENT_AUTH_TOKEN` on the agent and `MANDATE_AGENT_AUTH_TOKEN` in the Vercel server environment. That credential is server-only and must never use the `NEXT_PUBLIC_` prefix. Public values still fail closed when the profile is absent, malformed, or inconsistent with live chain state.

### Sepolia smart-wallet gas sponsorship

The owner receives test-only Sepolia USDC from the ENSv2 deployment, not real USDC and not ETH. The token reports symbol `USDC` and six decimals onchain. The output token reports symbol `DAI` and 18 decimals; the fixed venue is pre-funded with test-only DAI.

The authority composer submits atomic batches through Privy's `useSmartWallets()` client. Configure its account-abstraction paymaster:

1. Open the app in [Privy Dashboard](https://dashboard.privy.io/apps).
2. Open **Wallet infrastructure → Advanced → Smart wallets** and select **Sepolia**.
3. Keep **Alchemy Smart Wallets**, then use **Quick setup → Alchemy**.
4. Select an Ethereum Sepolia Alchemy app and Gas Manager policy. Enter the requested endpoint key and policy ID, then save.
5. Confirm the Sepolia smart-wallet entry has a non-empty **Paymaster URL**. The development bundler may remain the default public Pimlico endpoint unless quick setup replaces it.
6. Return to `/issue` with a Privy smart wallet holding `0` Sepolia ETH and click **Fund 100 USDC**. Success means a sponsored Sepolia transaction hash appears and the canonical balance increases by exactly `100000000` raw units.

Privy's separate **Fee sponsorship** page and its billing credits apply to native embedded-wallet transaction submission; they do not substitute for the paymaster used by this smart-wallet client. A Pimlico `AA21 didn't pay prefund` error with empty `paymasterAndData` means the Sepolia paymaster is absent or not being selected.

Limit the Alchemy policy to Sepolia and this demo's smart wallet while validating the flow. For production, use policy rules or a server-approved sponsorship path that fail-closes and permits only the faucet, exact token approvals, Aqua ship/dock, Mandate activate, and Mandate revoke calls.

Rules:

- `SEPOLIA_RPC_URL` and API credentials are server-only unless a separate public RPC variable is deliberately added.
- No `NEXT_PUBLIC_` prefix for 1inch, Bazantic, database, or signer secrets.
- Never store a raw agent private key in a checked-in `.env`. Prefer encrypted keystore path plus injected password.
- Owner key never appears in any environment variable. Owner signs through the wallet.
- Logs print variable names/config status, never values.

## 4. Local database

After Task 1 creates Docker Compose:

```bash
docker compose up -d --wait postgres
pnpm --filter @mandate/db db:migrate
TEST_DATABASE_URL=postgresql://mandate:mandate@127.0.0.1:55432/mandate?sslmode=disable pnpm --filter @mandate/db test
```

Database is not an authority source. Dropping local data must not prevent reconstructing confirmed execution evidence from chain.

## 5. Local chain

Start Anvil for unit integration:

```bash
anvil --host 127.0.0.1 --port 8545
```

Deploy pinned Aqua, token/venue fixtures, ENS-compatible identity fixture, and Mandate using the deterministic local script. Fixture contracts are for tests only and must have names that include `Mock` or `Test`. UI labels the environment `LOCAL FIXTURE`.

Capture a live 1inch route and its finalized-block deployment manifest:

```bash
pnpm --filter @mandate/chain capture:route
```

Then replay the exact route against the production Mandate app, official Aqua, and real 1inch liquidity at the manifest's pinned block:

```bash
pnpm verify:venue
```

`verify:venue` reads the block from `packages/contracts/src/deployments/mainnet.json`. Foundry must be available as `forge`, or `FORGE_BIN` must point to the executable. The manifest records only public route and runtime evidence; secrets remain in the ignored `.env`.

## 6. ENSv2 Sepolia setup

1. Read the current [ENSv2 overview](https://docs.ens.domains/ensv2/overview) and [contract developer tutorial](https://docs.ens.domains/ensv2/tutorial-contract-developers/).
2. Record official Sepolia registry/resolver addresses, source revisions, and code hashes in the deployment manifest.
3. Acquire a parent name/subregistry controlled by the treasury demo wallet.
4. Register a finite-expiry agent subname.
5. Set its current token owner and resolver address record to the dedicated agent according to the selected registry flow.
6. Run the probe script that reads status, expiry, current token ID, owner, resolver, and address at one block.
7. Run an owner stop action and prove the same execution fails.

Do not use ENSv1 contracts or a hard-coded name string for the ENSv2 prize proof.

## 7. Aqua setup

1. Check current official deployment support.
2. If Sepolia has no compatible official Aqua, deploy the pinned source and set `official: false` in manifest.
3. Verify code hash and source.
4. Approve strategy tokens from the owner to Aqua.
5. Ship `abi.encode(strategy)` with both tokens, output initialized to zero.
6. Compare local, app, return, and `Shipped` hashes.
7. Activate Mandate and read both raw balances.

Never label self-deployed Aqua as an official 1inch deployment.

## 8. Agent signer

Generate a new EOA exclusively for Mandate. Record public address only. Encrypt key material using a standard keystore and load it only inside `apps/agent`.

Operational constraints:

- fund with enough native token for bounded demo gas only;
- transfer no USDC/WETH or other treasury asset to agent;
- expose no generic signing or arbitrary transaction endpoint;
- keep `AGENT_HOST=127.0.0.1` unless a private container network is required; any `0.0.0.0` bind fails startup without `AGENT_AUTH_TOKEN`;
- require expected chain ID, Mandate address, strategy hash, selector, and amount caps in signer configuration;
- rotate/revoke immediately if logs or environment handling are uncertain.

## 9. Running services

Start local PostgreSQL only when not using the managed Supabase database:

```bash
docker compose up -d --wait postgres
pnpm --filter @mandate/db db:migrate
```

From the repository root, start the complete judge demo, including web, API, receipt worker, and the dedicated constrained-agent HTTP service, in one terminal:

```bash
pnpm dev
```

- Web: [http://localhost:3100](http://localhost:3100). Port 3100 is explicitly pinned in `apps/web/package.json`.
- API: [http://localhost:3001/openapi.json](http://localhost:3001/openapi.json), configurable through `API_PORT`.
- Agent: [http://localhost:3002/health](http://localhost:3002/health), configurable through `AGENT_PORT`. It loads the encrypted dedicated-agent keystore and accepts only `{ chainId, strategyHash }` demo requests.
- Worker: no HTTP port. It polls pending observed executions and commits evidence only after canonical-chain confirmation.

Use `pnpm --filter @mandate/agent start -- path/to/intent.json` only for the separate one-shot/manual-intent workflow. It is not the HTTP service used by the inspector’s **Run bounded demo execution** action.

The web surface uses same-origin typed API routes for mandate inspection, execution lookup, receipt audit, and the narrow agent proxy. Browser code never receives the agent signer, route calldata, or server credentials, and unavailable or stale chain data never becomes a green state.

## 10. Bazantic setup

1. Create/authenticate account using current Bazantic instructions.
2. Register the Mandate Inspector URL as a new x402/MPP service.
3. Price the smallest permitted amount appropriate for repeated tests.
4. Create a Recipe calling a live 1inch trace/data service and Mandate Inspector.
5. Validate both responses against schemas and merge by exact chain/transaction hash.
6. Execute a paid end-to-end request and record request IDs, payment receipt, response hashes, and video.
7. Redact credentials from recordings and committed fixtures.

## 11. Project skills

Project-scoped skills live in `.agents/skills`. Provenance: [SOURCES](../../.agents/skills/SOURCES.md). Relevant roles:

- `mandate-constrained-execution` — installable safety contract for Codex and Claude Code:

  ```bash
  npx skills add febrinirwana/mandate --skill mandate-constrained-execution --agent codex --copy -y
  npx skills add febrinirwana/mandate --skill mandate-constrained-execution --agent claude-code --copy -y
  ```

- `mandate-contract-engineer`
- `mandate-security-auditor`
- `mandate-integration-engineer`
- `mandate-backend-wiring`
- `mandate-frontend-polish`
- official `1inch-aqua`/`1inch-infrastructure`/`1inch-swap` usage guidance

The global `emil-design-eng` skill is intentionally not duplicated.

## 12. Verification commands

Run the smallest relevant command during development, then this release sequence:

```bash
pnpm lint
pnpm typecheck
pnpm test
forge fmt --check
forge build
forge test
pnpm test:integration
pnpm test:e2e
pnpm verify:deployments
pnpm verify:docs
```

A command exists only after its task implements the corresponding workspace script. Do not claim verification from an absent command or a fixture-only test.

## 13. Secret and artifact checklist

Before commit/submission:

- no `.env`, keystore, mnemonic, private key, API key, database dump, or wallet session artifact;
- no raw signed transactions containing sensitive unpublished intent unless intentionally public;
- deployment manifest contains addresses and hashes only;
- recorded logs use request IDs and response hashes;
- fixture and fork data are clearly labeled;
- all public links resolve without authentication where judges need them.
