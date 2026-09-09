import type { ExecutionV1, ReceiptAuditV1 } from "@mandate/domain";
import { expect, it, vi } from "vitest";

import {
  prepareManualExecution,
  runAutomatedExecution,
  type AgentAuthority,
} from "../src/index.js";
import { createSignerForTransport } from "../src/signer.js";
import { authority, now, policy, request, simulation, strategy } from "./fixtures.js";

const intent = {
  chainId: request.chainId,
  strategy,
  amountIn: request.amountIn,
  agentMinOut: request.agentMinOut,
  executionDeadline: request.executionDeadline,
  routeData: request.routeData,
  simulation,
};
const execution: ExecutionV1 = {
  version: 1,
  chainId: request.chainId,
  txHash: strategy.salt,
  block: { number: "102", hash: `0x${"e".repeat(64)}` },
  transactionIndex: "0",
  strategyHash: simulation.binding.strategyHash,
  caller: strategy.agent,
  amountIn: request.amountIn,
  amountOut: request.agentMinOut,
  usedInputAfter: "75",
  status: "CONFIRMED",
};
const audit: ReceiptAuditV1 = {
  version: 1,
  result: "COMPLIANT",
  chainId: request.chainId,
  txHash: strategy.salt,
  block: execution.block,
  strategyHash: simulation.binding.strategyHash,
  checks: [],
  evidence: [{ provider: "rpc-receipt", responseHash: `0x${"f".repeat(64)}` }],
};

function runtimeAuthority(order: string[], executionOverride: ExecutionV1 = execution): AgentAuthority {
  const base = authority();
  return {
    readMandate: () => {
      order.push("inspect");
      return base.readMandate();
    },
    simulate: () => {
      order.push("simulate");
      return base.simulate();
    },
    getBlockHash: () => {
      order.push("canonical");
      return base.getBlockHash();
    },
    readExecution: () => {
      order.push("receipt");
      return Promise.resolve(executionOverride);
    },
    auditReceipt: () => {
      order.push("audit");
      return Promise.resolve(audit);
    },
  };
}

it("runs inspect, exact simulation, constrained send, canonical receipt, then audit", async () => {
  const order: string[] = [];
  const chain = runtimeAuthority(order);
  const signer = createSignerForTransport({
    send: () => {
      order.push("send");
      return Promise.resolve(strategy.salt);
    },
    wait: () => {
      order.push("wait");
      return Promise.resolve({ status: "success" });
    },
  });

  const result = await runAutomatedExecution(intent, { policy, authority: chain, signer, now: () => now });

  expect(result).toEqual({ mode: "AUTOMATED", txHash: strategy.salt, execution, audit });
  expect(order).toEqual([
    "inspect",
    "simulate",
    "canonical",
    "canonical",
    "send",
    "wait",
    "receipt",
    "audit",
  ]);
});

it("fails closed when the mined receipt is not canonical", async () => {
  const order: string[] = [];
  const chain = runtimeAuthority(order, { ...execution, status: "REORGED" });
  chain.auditReceipt = vi.fn(() => Promise.resolve(audit));
  const signer = createSignerForTransport({
    send: () => Promise.resolve(strategy.salt),
    wait: () => Promise.resolve({ status: "success" }),
  });

  await expect(
    runAutomatedExecution(intent, { policy, authority: chain, signer, now: () => now }),
  ).rejects.toMatchObject({ reason: "RECEIPT_NOT_CANONICAL" });
  expect(chain.auditReceipt).not.toHaveBeenCalled();
});

it("manual mode returns only the same exact validated zero-value Mandate request", async () => {
  const result = await prepareManualExecution(intent, {
    policy,
    authority: authority(),
    now: () => now,
  });

  expect(result.mode).toBe("MANUAL");
  expect(Object.keys(result).sort()).toEqual(["mode", "request"]);
  const { data, ...manual } = result.request;
  expect(data).toMatch(/^0x[0-9a-f]+$/);
  expect(manual).toEqual({
    chainId: policy.chainId,
    account: policy.signer,
    to: policy.mandateApp,
    value: 0n,
  });
});

it("manual mode rejects stale evidence before browser-wallet handoff", async () => {
  await expect(
    prepareManualExecution(
      {
        ...intent,
        simulation: {
          ...simulation,
          binding: { ...simulation.binding, expiresAt: now.toISOString() },
        },
      },
      { policy, authority: authority(), now: () => now },
    ),
  ).rejects.toMatchObject({ reason: "SIMULATION_STALE" });
});
