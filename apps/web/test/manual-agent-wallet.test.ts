import { prepareExecution } from "@mandate/agent/manual";
import { afterEach, expect, it, vi } from "vitest";

import { submitPreparedExecution } from "../src/lib/wallet";
import {
  authority,
  now,
  policy,
  request,
  simulation,
  strategy,
} from "../../agent/test/fixtures.js";

afterEach(() => {
  Reflect.deleteProperty(globalThis, "window");
});

it("submits only an authentic prepared Mandate execution through the dedicated browser wallet", async () => {
  const prepared = await prepareExecution(
    {
      chainId: request.chainId,
      strategy,
      amountIn: request.amountIn,
      agentMinOut: request.agentMinOut,
      executionDeadline: request.executionDeadline,
      routeData: request.routeData,
      simulation,
    },
    policy,
    authority(),
    { now: () => now },
  );
  const sendTransaction = vi.fn(() => Promise.resolve(strategy.salt));
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      ethereum: {
        request: ({ method }: { method: string }) => {
          if (method === "eth_chainId") return Promise.resolve("0xaa36a7");
          if (method === "eth_requestAccounts") return Promise.resolve([strategy.agent]);
          if (method === "eth_sendTransaction") return sendTransaction();
          return Promise.reject(new Error("unexpected method"));
        },
      },
    },
  });

  await expect(submitPreparedExecution(prepared)).resolves.toEqual({
    kind: "SUBMITTED",
    txHash: strategy.salt,
  });
  expect(sendTransaction).toHaveBeenCalledOnce();
});

it("rejects a forged prepared object before reaching the browser wallet", async () => {
  const requestMethod = vi.fn(() => Promise.resolve(strategy.salt));
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { ethereum: { request: requestMethod } },
  });

  await expect(
    submitPreparedExecution({ kind: "MANDATE_EXECUTE_PREPARED" } as never),
  ).rejects.toMatchObject({ reason: "INVALID_STRATEGY" });
  expect(requestMethod).not.toHaveBeenCalled();
});
