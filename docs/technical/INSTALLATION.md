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

Create local `.env` files from the checked-in example after scaffold. Minimum server-only variables:

```dotenv
DATABASE_URL=postgresql://mandate:mandate@127.0.0.1:5432/mandate
SEPOLIA_RPC_URL=https://...
SETTLEMENT_FORK_RPC_URL=https://...
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...
ONEINCH_API_KEY=...
BAZANTIC_API_KEY=...
AGENT_KEYSTORE_PATH=...
AGENT_KEYSTORE_PASSWORD=...
```

Rules:

- `SEPOLIA_RPC_URL` and API credentials are server-only unless a separate public RPC variable is deliberately added.
- No `NEXT_PUBLIC_` prefix for 1inch, Bazantic, database, or signer secrets.
- Never store a raw agent private key in a checked-in `.env`. Prefer encrypted keystore path plus injected password.
- Owner key never appears in any environment variable. Owner signs through the wallet.
- Logs print variable names/config status, never values.

## 4. Local database

After Task 1 creates Docker Compose:

```bash
docker compose up -d postgres
pnpm --filter @mandate/db migrate
pnpm --filter @mandate/db test
```

Database is not an authority source. Dropping local data must not prevent reconstructing confirmed execution evidence from chain.

## 5. Local chain

Start Anvil for unit integration:

```bash
anvil --host 127.0.0.1 --port 8545
```

Deploy pinned Aqua, token/venue fixtures, ENS-compatible identity fixture, and Mandate using the deterministic local script. Fixture contracts are for tests only and must have names that include `Mock` or `Test`. UI labels the environment `LOCAL FIXTURE`.

For real settlement, fork a verified supported chain at a pinned block:

```bash
anvil --fork-url "$SETTLEMENT_FORK_RPC_URL" --fork-block-number <verified-block>
```

The concrete block is recorded only after a successful live probe. Never leave `<verified-block>` in an executable script or claimed result.

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

Expected commands after implementation:

```bash
pnpm dev
pnpm --filter @mandate/agent dev
pnpm --filter @mandate/worker dev
```

A single `pnpm dev` may run web/API for local convenience. The signer process remains separately configured and can be disabled; public inspection and manual-agent simulation still work.

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
