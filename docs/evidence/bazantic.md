# Bazantic Route-Assurance Evidence

## Scope

Task 11 publishes a mainnet **route-policy assurance** flow. It does not claim that a mainnet 1inch route proves the separate Sepolia receipt. The existing Sepolia receipt audit remains available as another Mandate Inspector operation.

## Attribution and public identifiers

Recorded from the authenticated Bazantic dashboard on 10 September 2026:

| Field                     | Value                                              |
| ------------------------- | -------------------------------------------------- |
| Bazantic account username | `Febri`                                            |
| Recipe name               | `Mandate 1inch Route Assurance`                    |
| Recipe handle             | `mandate-1inch-route-assurance`                    |
| Recipe ID                 | `05132729-6750-4183-b8fa-4f70b5061b21`             |
| Published at              | `2026-09-10T05:30:15.187Z`                         |
| 1inch gateway ID          | `gkrbmuh3urcytk6aumsvf2kyxm`                       |
| Mandate gateway ID        | `soinswyiozdb7caskqudzeojgq`                       |
| 1inch MCP                 | `https://mandate-oneinch-route.bazgateway.com/mcp` |
| Mandate MCP               | `https://mandate-inspector.bazgateway.com/mcp`     |
| Recipe model              | `anthropic/claude-sonnet-4.6`                      |

The Recipe binds exactly two tools, in order:

1. 1inch `getClassicSwapRoute`;
2. Mandate `assessOneInchRoute`.

`docs/evidence/bazantic-recipe-published.jpg` shows the published, read-only Recipe definition without the dashboard sidebar. `docs/evidence/bazantic-recipe-bindings.jpg` shows both exact gateway/tool bindings and Bazantic's notice that the dashboard Test path performs no payment. Neither capture contains a credential, balance, email, or wallet key.

## Public backend proof

The Task 11 API was exposed through the temporary deployment origin `https://unrevised-jubilance-plated.ngrok-free.dev`; Bazantic's stable public surface is the custom gateway hostname above. Public OpenAPI retrieval returned HTTP 200 and exposed `assessOneInchRoute`.

At `2026-09-10T06:23:41.823Z`, the public assessor returned the following consumer-visible outcomes from schema-valid requests with a fresh execution window:

| Case                  | HTTP | Request ID              | Result / reason                   | 1inch evidence hash                                                  | Mandate strategy hash                                                |
| --------------------- | ---: | ----------------------- | --------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------- |
| admitted route        |  200 | `task11-public-pass`    | `PASS`                            | `0x0263045690e4b03a21b767c641f89c0dbe1b60f64c7bb60c7cd7c18185a20ace` | `0x262594d99dd359685540017f7d581a3f967db898798e6459e6c067917be8b9b0` |
| provider timeout      |  200 | `task11-public-unknown` | `UNKNOWN` / `ONEINCH_UNAVAILABLE` | `0xcc93397b73651e45500ad10f482efec46fc8f14f351fe8a2906198060577d922` | `0x262594d99dd359685540017f7d581a3f967db898798e6459e6c067917be8b9b0` |
| mutated router target |  200 | `task11-public-fail`    | `FAIL` / `TARGET_MISMATCH`        | `0x8f5e0f0f93688f87bf25f6ee8f6329a9d7c296eb2041bfdb9905a6a0b471d23a` | `0x262594d99dd359685540017f7d581a3f967db898798e6459e6c067917be8b9b0` |

The same strategy hash across the three rows proves that only provider availability/route evidence changed. A provider alone cannot create `PASS`: Mandate decodes the calldata and applies deterministic `FAIL > UNKNOWN > PASS` precedence.

A live dashboard Recipe test also called both gateways and returned a Mandate `PASS` assessment with Recipe-visible 1inch request ID `ca48ca6d-476a-4e2c-b9c4-28922963a2f7` and strategy hash `0x64b1cf19842a0ae005496463a55eb0efb65fa391057d9cbd4bb126a5b491fdd4`. This proves composition, not payment; Bazantic explicitly labels that test path as unpaid.

## x402 payment boundary

The Mandate audit gateway returned HTTP 402 with x402 version 2, exact scheme, Base network `eip155:8453`, USDC asset `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, and amount `10` base units. The configured dashboard price is 1 millicent per call.

The final paid Recipe invocation is not yet evidence-complete. The Bazantic hosted balance was `$0.00`, and its Add Funds flow requires a backup login method before funding. No payment reference exists yet. This repository therefore does **not** mark the paid-execution or full redacted-ID checklist items complete, and it does not relabel the unpaid dashboard test as paid proof.
