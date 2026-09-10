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
| Published at              | `2026-09-10T07:28:18.758Z`                         |
| 1inch gateway ID          | `gkrbmuh3urcytk6aumsvf2kyxm`                       |
| Mandate gateway ID        | `soinswyiozdb7caskqudzeojgq`                       |
| 1inch MCP                 | `https://mandate-oneinch-route.bazgateway.com/mcp` |
| Mandate MCP               | `https://mandate-inspector.bazgateway.com/mcp`     |
| Recipe model              | `anthropic/claude-haiku-4.5`                       |

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

## Published Recipe execution

The public Recipe MCP gateway `https://jtc64fcl6jbgzbohqrkfeu4may.bazgateway.com/recipe-mcp` listed `mandate-1inch-route-assurance` and returned HTTP 200 from a live invocation at `2026-09-10T07:28:56.667Z`. The first two Sonnet attempts exceeded the gateway timeout; changing only the published model to `anthropic/claude-haiku-4.5` produced the complete result without changing the schema, prompt, or tool bindings.

The successful Recipe result was `PASS`, with 1inch request ID `c69a1f4e-ad78-4077-a014-82bd01d791cd`, strategy hash `0x083eeb4cc34e1bfb06191876baf16920e56eed60c6163019fffc7db358a719e1`, 1inch evidence hash `0xf9ec9f2bceaac5682c6a4a42efa79fcd607b212d62aef7d6490d13f75124c769`, and the same strategy hash as Mandate evidence. All eight deterministic checks returned `PASS`.

The Recipe MCP response contained `paid: null`: Bazantic's public Recipe gateway did not issue an x402 challenge. This is recorded rather than relabelled as a paid Recipe-level settlement.

## x402 paid ingredient replay

A verified, all-service spend grant `c58a779a-393d-475f-b63d-405fff8566e6` was capped at `0.01 USDC` on Base and revoked after the proof. The exact Recipe sequence was replayed through the two priced public gateways:

| Step | Gateway/tool                 | Result                                                                                                   |                           Amount | Settlement                                                                                                                                                         |
| ---- | ---------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | 1inch `getClassicSwapRoute`  | HTTP 200; target `0x111111125421ca6dc452d289314280a0f8842a65`; selector `0x07ed2379`; output `245994143` | `10` USDC base units (`0.00001`) | [`0x19faef678b5585b9f9a0852e4c3be528d9d94408174a8e4681bc02f3e00f8c6a`](https://basescan.org/tx/0x19faef678b5585b9f9a0852e4c3be528d9d94408174a8e4681bc02f3e00f8c6a) |
| 2    | Mandate `assessOneInchRoute` | HTTP 200; `PASS`; all eight checks passed                                                                | `10` USDC base units (`0.00001`) | [`0x7897578d829caa367a8fd368d30ad0d712d17d063cdc9c4c6c9c9202c1ee3938`](https://basescan.org/tx/0x7897578d829caa367a8fd368d30ad0d712d17d063cdc9c4c6c9c9202c1ee3938) |

The first receipt is canonical at Base block `51118034`, hash `0x7231c4cc0213213e1fd39e92e8aa335ab0eb18170ed5d651934c823da697e38a`. The second is canonical at block `51118060`, hash `0x3238897f15f4686f34eb6f041cecac31c418d503b8117a04372337f8d2168447`. Both receipt statuses are `1`.

The paid Mandate result binds route request ID `bazantic-payment-0x19faef678b5585b9f9a0852e4c3be528d9d94408174a8e4681bc02f3e00f8c6a`, strategy hash `0x35926e0c5e28814df4d489361a10f5e340fd8fd0df0862bed2b445c09a5ffc99`, 1inch response hash `0x935c233ed0398ef02a59bd1560562dbf380beee437fbaf6da4a6c49abec34d59`, and equal Mandate strategy evidence.

Both gateways and the payer are owned by the same Bazantic account, so each test settlement emitted a successful `10`-unit USDC transfer from and to `0x6835A6c084c011452Eeecf130745114CE0783A19`. The self-payment proves the x402 authorization and canonical settlement path without reducing the account's net balance. It is not described as third-party revenue.

`integrations/bazantic/paid-proof.json` is the red-readable record containing Recipe identifiers, public run output bindings, grant ID, payment transactions, canonical blocks, route facts, checks, and evidence hashes. It omits grant credentials, authorization headers, raw payment receipts, API keys, and provider calldata.
