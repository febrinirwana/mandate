# Bazantic route-assurance integration

This directory contains the public, credential-free definition for the published **Mandate 1inch Route Assurance** Recipe.

## Published services

| Component                  | Public identifier               | Public endpoint                                           |
| -------------------------- | ------------------------------- | --------------------------------------------------------- |
| 1inch Classic Swap gateway | `gkrbmuh3urcytk6aumsvf2kyxm`    | `https://mandate-oneinch-route.bazgateway.com/mcp`        |
| Mandate Inspector gateway  | `oj7vvrmizvfhfpbo737wqdphcq`    | `https://oj7vvrmizvfhfpbo737wqdphcq.bazgateway.com/mcp`   |
| Recipe                     | `mandate-1inch-route-assurance` | Bazantic Recipe ID `05132729-6750-4183-b8fa-4f70b5061b21` |

The Recipe binds `getClassicSwapRoute` first and `assessOneInchRoute` second. The 1inch response is passed unmodified to Mandate. Only Mandate's deterministic `PASS`, `FAIL`, or `UNKNOWN` response is returned; the model may not infer or upgrade a result.

The Recipe was rebound on 11 September 2026 after its previous Mandate gateway was deleted. A live dashboard test through the replacement binding returned `PASS` with all eight deterministic checks passing.

## Files

- `oneinch-classic.openapi.json`: narrow OpenAPI source used to register the 1inch gateway. It contains no bearer token.
- `recipe.json`: exact published Recipe control definition, excluding server-generated owner/status/timestamp fields.
- `fixtures/pass-request.json`: deterministic valid assessor request.
- `fixtures/unavailable-request.json`: deterministic provider-timeout request that must remain `UNKNOWN`.
- `paid-proof.json`: public identifiers, canonical Base settlement references, Recipe result bindings, and no credentials or raw payment authorization.

The fixtures are direct inputs for `POST /v1/routes/1inch/assess`; they do not call or pay 1inch. The Recipe's live run obtains a fresh provider response instead.

## Replay

1. Import `oneinch-classic.openapi.json` into a 1inch Bazantic gateway and store the bearer credential only in Bazantic's secret field.
2. Register the Mandate API OpenAPI document and price only the intended operations. The public gateway currently uses the minimum UI price of **1 millicent per call** (`10` USDC base units on Base).
3. Create or update the Recipe from `recipe.json`, then confirm the two exact tool bindings before publication.
4. Test the draft for tool/schema correctness. Bazantic labels this test path **No payment occurs**; it is not paid-flow evidence.
5. Invoke the published Recipe through `https://jtc64fcl6jbgzbohqrkfeu4may.bazgateway.com/recipe-mcp`.
6. Replay its exact two-step path through the priced 1inch and Mandate gateways with a funded, capped spend grant; bind the paid 1inch response unmodified into the paid Mandate assessment.

On 10 September 2026, Bazantic's published documentation described `baz recipe` commands, while public npm package `@bazantic/cli@0.8.0` did not expose them. The dashboard was used for creation and the generated Recipe MCP URL for the public invocation. Bazantic returned `paid: null` for the Recipe-level call, while both direct ingredient calls produced canonical x402 settlements. `paid-proof.json` records this distinction rather than treating the free draft test or unpriced Recipe response as payment evidence.

## Trust boundary

The 1inch gateway supplies executable route data. Mandate independently decodes it and checks target, selector, caller, recipient, tokens, exact amount, native value, partial-fill flag, per-call cap, rate floor, route minimum, and execution window. Provider unavailability or malformed evidence returns `UNKNOWN`; disagreement returns `FAIL`. A paid HTTP response is never treated as proof of `PASS` by itself.
