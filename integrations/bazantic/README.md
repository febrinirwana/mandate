# Bazantic route-assurance integration

This directory contains the public, credential-free definition for the published **Mandate 1inch Route Assurance** Recipe.

## Published services

| Component                  | Public identifier               | Public endpoint                                           |
| -------------------------- | ------------------------------- | --------------------------------------------------------- |
| 1inch Classic Swap gateway | `gkrbmuh3urcytk6aumsvf2kyxm`    | `https://mandate-oneinch-route.bazgateway.com/mcp`        |
| Mandate Inspector gateway  | `soinswyiozdb7caskqudzeojgq`    | `https://mandate-inspector.bazgateway.com/mcp`            |
| Recipe                     | `mandate-1inch-route-assurance` | Bazantic Recipe ID `05132729-6750-4183-b8fa-4f70b5061b21` |

The Recipe binds `getClassicSwapRoute` first and `assessOneInchRoute` second. The 1inch response is passed unmodified to Mandate. Only Mandate's deterministic `PASS`, `FAIL`, or `UNKNOWN` response is returned; the model may not infer or upgrade a result.

## Files

- `oneinch-classic.openapi.json`: narrow OpenAPI source used to register the 1inch gateway. It contains no bearer token.
- `recipe.json`: exact published Recipe control definition, excluding server-generated owner/status/timestamp fields.
- `fixtures/pass-request.json`: deterministic valid assessor request.
- `fixtures/unavailable-request.json`: deterministic provider-timeout request that must remain `UNKNOWN`.

The fixtures are direct inputs for `POST /v1/routes/1inch/assess`; they do not call or pay 1inch. The Recipe's live run obtains a fresh provider response instead.

## Replay

1. Import `oneinch-classic.openapi.json` into a 1inch Bazantic gateway and store the bearer credential only in Bazantic's secret field.
2. Register the Mandate API OpenAPI document and price only the intended operations. The public gateway currently uses the minimum UI price of **1 millicent per call** (`10` USDC base units on Base).
3. Create or update the Recipe from `recipe.json`, then confirm the two exact tool bindings before publication.
4. Test the draft for tool/schema correctness. Bazantic labels this test path **No payment occurs**; it is not paid-flow evidence.
5. Invoke the published Recipe from Bazantic's Recipe MCP server with a funded, capped spend grant or a funded self-custody Bazantic wallet. Record the payment reference and exact response evidence hashes.

On 10 September 2026, Bazantic's published documentation described `baz recipe` commands, while public npm package `@bazantic/cli@0.8.0` did not expose them. The dashboard was therefore used for Recipe creation, test, publication, and binding verification. Do not replace the live paid step with the free draft test.

## Trust boundary

The 1inch gateway supplies executable route data. Mandate independently decodes it and checks target, selector, caller, recipient, tokens, exact amount, native value, partial-fill flag, per-call cap, rate floor, route minimum, and execution window. Provider unavailability or malformed evidence returns `UNKNOWN`; disagreement returns `FAIL`. A paid HTTP response is never treated as proof of `PASS` by itself.
