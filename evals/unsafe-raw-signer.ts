/**
 * TEST/EVAL ONLY. This models the capability that production intentionally does not expose.
 * It accepts arbitrary destination, calldata, and native value without policy checks.
 */
export function unsafeRawSignerBaseline(_request: {
  to: `0x${string}`;
  data: `0x${string}`;
  value: bigint;
}): "ARBITRARY_TRANSACTION_ACCEPTED" {
  return "ARBITRARY_TRANSACTION_ACCEPTED";
}
