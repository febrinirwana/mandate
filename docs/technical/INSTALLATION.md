# Mandate Installation and Bootstrap Contract

This repository currently contains the build-ready specification and project-scoped skills. Application and contract scaffolding begins during ETHOnline so event-created work is auditable.

## 1. Required tools

- Git
- Node.js active LTS, minimum 22
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
SEPOLIA_MANDATE_APP=0x...
SEPOLIA_MANDATE_DEPLOYMENT_BLOCK=11648628
ONEINCH_API_KEY=...
BAZANTIC_API_KEY=...
API_PORT=3001
WORKER_CONFIRMATION_DEPTH=4
WORKER_BATCH_SIZE=25
WORKER_POLL_INTERVAL_MS=15000
```

For the Next.js authority composer, create the ignored `apps/web/.env.local` with `MANDATE_CHAIN_ID=11155111`, the same `SEPOLIA_MANDATE_APP`, `MANDATE_API_ORIGIN`, `NEXT_PUBLIC_PRIVY_APP_ID`, and `MANDATE_SEPOLIA_FAUCET_AMOUNT=100`. `MANDATE_POLICY_PROFILE` is a single-line JSON object containing the verified agent name/address, ENS registry/resolver/label/node, MockUSDC/MockDAI symbols/addresses/decimals, and deployed route target/selector. These are public onchain values but must be generated from verified deployment reads; the composer fails closed when the profile is absent or malformed.

### Sepolia smart-wallet gas sponsorship

The owner receives **official ENSv2 Sepolia MockUSDC**, not real USDC and not ETH. MockUSDC is freely mintable on this testnet, so the browser can fund the same Privy smart-wallet address that issues authority. MockDAI is the output asset and is pre-funded in the fixed demo venue. Sepolia ETH is used only for gas; the Alchemy paymaster removes that user prerequisite.

Configure the paymaster after the fresh Mandate and venue addresses are known:

1. Open [Alchemy Dashboard](https://dashboard.alchemy.com/) and create or select the app dedicated to Mandate.
2. Enable **Ethereum Sepolia** on that app. Do not select Base Sepolia or another testnet.
3. Open **Wallets → Gas Sponsorship**, create a policy, and choose **Gas Sponsorship / BSO**. Alchemy recommends this policy type for ERC-4337 smart wallets.
4. Enable only **Ethereum Sepolia** for the policy.
5. Set a hard total spend limit, a per-transaction spend limit, a total transaction limit, and a per-sender transaction limit. For the public demo, start with at most `100` sponsored transactions and `12` transactions per sender; choose the smallest spend ceilings that still pass one faucet, issuance, and revoke run.
6. Keep the policy inactive until the limits are saved. If Alchemy exposes sender access controls, leave the sender list open only while smart-wallet addresses are not known; add the final demo wallets before publishing.
7. Copy the **Policy ID**. It is public configuration, not an API secret, but it belongs to the selected Alchemy app and Sepolia chain.
8. Open [Privy Dashboard](https://dashboard.privy.io/apps?page=smart-wallets), select this app, and keep **Alchemy Smart Wallets** enabled.
9. Under the smart-wallet **Sepolia** network, enter the Alchemy gas policy ID in the **Paymaster** field. The bundler field may remain empty for development; Privy then uses its rate-limited public Pimlico bundler. Configure a dedicated bundler before production traffic.
10. Save the Privy configuration. Do not put the policy ID, bundler URL, or paymaster URL in `NEXT_PUBLIC_*` environment variables; the dashboard supplies them to the smart-wallet provider.
11. Test with a new Privy user whose smart wallet has `0` Sepolia ETH. Click **Fund 100 MockUSDC**. Success means a Sepolia transaction hash appears and the card’s canonical balance increases by exactly `100000000` raw units.
12. If the wallet reports a prefund/paymaster error, confirm that the policy is active, belongs to the same Alchemy app, targets chain `11155111`, has remaining limits, and is entered under Privy’s Sepolia smart-wallet network. If the request is rate-limited, configure a dedicated bundler rather than weakening sponsorship limits.

Before a public demo, apply Alchemy’s strictest available contract/call controls or a fail-closed sponsorship webhook. Permit only the deployed MockUSDC faucet call and the exact MockUSDC approval, MockDAI zero approval, Aqua ship, Mandate activate, and Mandate revoke calls. Set webhook `approveOnFailure` to `false`. Disable the sponsorship policy immediately after the judging window.

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
- require expected chain ID, Mandate address, strategy hash, selector, and amount caps in signer configuration;
- rotate/revoke immediately if logs or environment handling are uncertain.

## 9. Running services

Start local PostgreSQL only when not using the managed Supabase database:

```bash
docker compose up -d --wait postgres
pnpm --filter @mandate/db db:migrate
```

From the repository root, run the web app, API, and receipt-confirmation worker in one terminal:

```bash
pnpm --parallel --filter @mandate/web --filter @mandate/api --filter @mandate/worker run dev
```

- Web: [http://localhost:3100](http://localhost:3100). Port 3100 is explicitly pinned in `apps/web/package.json`.
- API: [http://localhost:3001/openapi.json](http://localhost:3001/openapi.json), configurable through `API_PORT`.
- Worker: no HTTP port. It polls pending observed executions and commits evidence only after canonical-chain confirmation.

The web surface uses same-origin typed API routes for mandate inspection, simulation, execution lookup, and receipt audit. It never treats unavailable or stale chain data as a green state.

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
