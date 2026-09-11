import { describe, expect, it } from "vitest";

import { prepareExecution } from "../src/index.js";
import type { AgentRejection } from "../src/index.js";
import { authority, now, policy, request, simulation, snapshot, strategy } from "./fixtures.js";

async function rejects(
  intent: Parameters<typeof prepareExecution>[0],
  expected: AgentRejection["reason"],
  authorityOverride = authority(),
) {
  await expect(
    prepareExecution(intent, policy, authorityOverride, { now: () => now }),
  ).rejects.toMatchObject({ reason: expected });
}

const intent = {
  chainId: request.chainId,
  strategy,
  amountIn: request.amountIn,
  agentMinOut: request.agentMinOut,
  executionDeadline: request.executionDeadline,
  routeData: request.routeData,
  simulation,
};

const changedAddress = (digit: string): `0x${string}` => `0x${digit.repeat(40)}`;

it("accepts only the exact configured Mandate execution intent", async () => {
  const prepared = await prepareExecution(intent, policy, authority(), { now: () => now });
  const { data, ...manual } = prepared.toManualRequest();
  expect(data).toMatch(/^0x[0-9a-f]+$/);
  expect(manual).toEqual({
    chainId: policy.chainId,
    account: policy.signer,
    to: policy.mandateApp,
    value: 0n,
  });
});

it("rejects an intent that tries to supply a transaction destination", async () => {
  const arbitraryTarget = { ...intent, to: changedAddress("f") };
  await rejects(arbitraryTarget, "INVALID_STRATEGY");
});

describe("configured authority", () => {
  it("rejects the wrong chain", async () => {
    await rejects({ ...intent, chainId: "1" }, "TARGET_MISMATCH");
  });

  it("rejects a strategy for another app binding", async () => {
    await rejects(
      {
        ...intent,
        simulation: { ...simulation, binding: { ...simulation.binding, to: changedAddress("f") } },
      },
      "TARGET_MISMATCH",
    );
  });

  it("rejects a strategy assigned to another signer", async () => {
    await rejects(
      { ...intent, strategy: { ...strategy, agent: changedAddress("f") } },
      "CALLER_NOT_AGENT",
    );
  });

  it("rejects unsupported tokens", async () => {
    await rejects(
      { ...intent, strategy: { ...strategy, tokenOut: changedAddress("f") } },
      "STRATEGY_HASH_MISMATCH",
    );
  });

  it("rejects another route target or selector", async () => {
    await rejects(
      { ...intent, strategy: { ...strategy, swapTarget: changedAddress("f") } },
      "TARGET_MISMATCH",
    );
    await rejects(
      { ...intent, strategy: { ...strategy, swapSelector: "0x87654321" } },
      "SELECTOR_MISMATCH",
    );
  });

  it("rejects route calldata with a different recipient", async () => {
    const badRoute =
      `${request.routeData.slice(0, -40)}${changedAddress("f").slice(2)}` as `0x${string}`;
    await rejects({ ...intent, routeData: badRoute }, "TARGET_MISMATCH");
  });
});

describe("amount and time policy", () => {
  it("rejects per-call and remaining-total cap breaches", async () => {
    await rejects({ ...intent, amountIn: "101" }, "PER_CALL_CAP_EXCEEDED");
    await rejects(
      { ...intent, amountIn: "50" },
      "TOTAL_CAP_EXCEEDED",
      authority({ state: { ...snapshot.state, usedInput: "451" } }),
    );
  });

  it("rejects deadlines outside the live strategy window", async () => {
    await rejects(
      { ...intent, executionDeadline: strategy.validUntil },
      "EXECUTION_DEADLINE_EXPIRED",
    );
  });
});

describe("current chain and simulation authority", () => {
  it("rejects revoked and unknown live state", async () => {
    await rejects(
      intent,
      "MANDATE_REVOKED",
      authority({ state: { ...snapshot.state, revoked: true }, result: "FAIL" }),
    );
    await rejects(intent, "ENS_READ_UNAVAILABLE", authority({ result: "UNKNOWN" }));
  });

  it("rejects stale, non-PASS, mismatched, and noncanonical simulation evidence", async () => {
    await rejects(
      {
        ...intent,
        simulation: {
          ...simulation,
          binding: { ...simulation.binding, expiresAt: now.toISOString() },
        },
      },
      "SIMULATION_STALE",
    );
    await rejects(
      {
        ...intent,
        simulation: { ...simulation, result: "UNKNOWN", reasons: ["ENS_READ_UNAVAILABLE"] },
      },
      "ENS_READ_UNAVAILABLE",
    );
    await rejects({ ...intent, agentMinOut: "49" }, "SIMULATION_STALE");
    await rejects(intent, "SIMULATION_STALE", {
      ...authority(),
      getBlockHash: () => Promise.resolve(changedAddress("f").padEnd(66, "f") as `0x${string}`),
    });
  });

  it("fails closed when inspection or simulation is unavailable", async () => {
    await rejects(intent, "ENS_READ_UNAVAILABLE", {
      ...authority(),
      readMandate: () => Promise.reject(new Error("rpc unavailable")),
    });
    await rejects(intent, "ENS_READ_UNAVAILABLE", {
      ...authority(),
      simulate: () => Promise.reject(new Error("api unavailable")),
    });
  });
});
