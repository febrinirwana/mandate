---
name: mandate-backend-wiring
description: Use when implementing Mandate APIs, simulation, agent transaction preparation, receipt indexing, Bazantic Recipe integration, persistence, or signer runtime boundaries.
---

# Mandate Backend Wiring

## Boundary
The backend observes, validates, simulates, prepares, and audits. Only the dedicated agent signer signs execution transactions. The service never accepts the treasury owner's private key.

## Rules
- One Zod schema owns each HTTP/MCP/Bazantic request and response; JSON encodes integers as decimal strings.
- Simulation is advisory. Return exact chain, block, caller, target, calldata hash, state snapshot, policy checks, and expiry; execution repeats all checks onchain.
- Stable outcomes are `PASS`, `FAIL`, or `UNKNOWN` with reason codes. Missing RPC, ENS, or receipt evidence cannot pass.
- Persist canonical identifiers and raw evidence before derived explanations. Reorg or replaced transaction evidence invalidates dependent audit records.
- Queue jobs are idempotent by chain plus transaction hash; never infer success from transaction submission.
- Bazantic exposes a genuinely new Mandate Inspector service and combines it with one live 1inch service in a Recipe. Do not proxy an existing sponsor endpoint and call it new.
- Redact secrets and signed payloads from logs; agent key material stays in a server-only signer boundary.
