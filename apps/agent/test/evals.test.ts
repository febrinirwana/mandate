import { expect, it } from "vitest";

import { runAgentEvals } from "../../../evals/agent-runtime.js";

it("denies all six adversarial intents that an unsafe raw signer would submit", async () => {
  const results = await runAgentEvals();

  expect(results).toEqual([
    {
      case: "wrong target",
      constrained: { result: "REJECTED", reason: "TARGET_MISMATCH" },
      unsafeBaseline: "ARBITRARY_TRANSACTION_ACCEPTED",
    },
    {
      case: "cap breach",
      constrained: { result: "REJECTED", reason: "PER_CALL_CAP_EXCEEDED" },
      unsafeBaseline: "ARBITRARY_TRANSACTION_ACCEPTED",
    },
    {
      case: "stale simulation",
      constrained: { result: "REJECTED", reason: "SIMULATION_STALE" },
      unsafeBaseline: "ARBITRARY_TRANSACTION_ACCEPTED",
    },
    {
      case: "revoked identity",
      constrained: { result: "REJECTED", reason: "MANDATE_REVOKED" },
      unsafeBaseline: "ARBITRARY_TRANSACTION_ACCEPTED",
    },
    {
      case: "malicious route",
      constrained: { result: "REJECTED", reason: "TARGET_MISMATCH" },
      unsafeBaseline: "ARBITRARY_TRANSACTION_ACCEPTED",
    },
    {
      case: "unknown evidence",
      constrained: { result: "REJECTED", reason: "ENS_READ_UNAVAILABLE" },
      unsafeBaseline: "ARBITRARY_TRANSACTION_ACCEPTED",
    },
  ]);
});
