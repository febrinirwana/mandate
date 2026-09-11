import type { MandateSnapshotV1 } from "@mandate/domain";
import { decodeFunctionData, parseAbi } from "viem";
import { expect, it, vi } from "vitest";

import { createDemoExecutionService, type DemoAutomatedExecution } from "../src/demo.js";
import { now, request, snapshot, strategy } from "./fixtures.js";

const venueAbi = parseAbi(["function swap(uint256 amountIn,uint256 amountOut,address recipient)"]);
const hash = (digit: string) => `0x${digit.repeat(64)}` as const;
const address = (digit: string) => `0x${digit.repeat(40)}` as const;

const profile = {
  agent: { name: "agent.mandate-test.eth", address: strategy.agent },
  ens: {
    registry: strategy.ensRegistry,
    resolver: strategy.ensResolver,
    label: strategy.ensLabel,
    node: strategy.ensNode,
  },
  tokenIn: { symbol: "USDC", address: strategy.tokenIn, decimals: 6 },
  tokenOut: { symbol: "DAI", address: strategy.tokenOut, decimals: 18 },
  route: { target: strategy.swapTarget, selector: strategy.swapSelector },
} as const;

const demoStrategy = {
  ...strategy,
  minRateNumerator: "3",
  minRateDenominator: "2",
  maxInputPerCall: "800000",
  maxInputTotal: "3000000",
} as const;
const demoSnapshot: MandateSnapshotV1 = {
  ...snapshot,
  strategyHash: hash("d"),
  strategy: demoStrategy,
  aqua: { ...snapshot.aqua, inputBalance: "500001" },
  state: { ...snapshot.state, usedInput: "2400000" },
} as const;

function confirmedResult(
  currentSnapshot: MandateSnapshotV1 = demoSnapshot,
): Awaited<ReturnType<DemoAutomatedExecution>> {
  const execution = {
    version: 1 as const,
    chainId: request.chainId,
    txHash: hash("a"),
    block: { number: "102", hash: hash("b") },
    transactionIndex: "0",
    strategyHash: currentSnapshot.strategyHash,
    caller: currentSnapshot.strategy.agent,
    amountIn: "500001",
    amountOut: "750002",
    usedInputAfter: "2900001",
    status: "CONFIRMED" as const,
  };
  return {
    txHash: execution.txHash,
    execution,
    audit: {
      version: 1,
      result: "COMPLIANT" as const,
      chainId: execution.chainId,
      txHash: execution.txHash,
      block: execution.block,
      strategyHash: execution.strategyHash,
      checks: [],
      evidence: [{ provider: "rpc-receipt", responseHash: hash("c") }],
    },
  };
}

function createService(
  currentSnapshot: MandateSnapshotV1 = demoSnapshot,
  authorityFailure?: Error,
  logger?: (entry: unknown) => void,
) {
  const runAutomatedExecution = vi
    .fn<DemoAutomatedExecution>()
    .mockResolvedValue(confirmedResult(currentSnapshot));
  const authority = {
    readMandate: authorityFailure
      ? vi.fn().mockRejectedValue(authorityFailure)
      : vi.fn().mockResolvedValue(currentSnapshot),
    simulate: vi.fn(),
    getBlockHash: vi.fn(),
    readExecution: vi.fn(),
    auditReceipt: vi.fn(),
  };
  const service = createDemoExecutionService({
    profile,
    runtime: {
      chainId: request.chainId,
      mandateApp: request.mandateApp,
      routeRecipient: request.mandateApp,
      maximumDemoInput: "3000000",
    },
    authority,
    runAutomatedExecution,
    now: () => now,
    ...(logger ? { logger } : {}),
  });
  return { service, runAutomatedExecution };
}

it("derives the bounded execution from fixed policy and the activated dynamic strategy hash", async () => {
  const { service, runAutomatedExecution } = createService();

  await expect(
    service.execute({ chainId: request.chainId, strategyHash: demoSnapshot.strategyHash }),
  ).resolves.toEqual({
    status: "CONFIRMED",
    txHash: hash("a"),
    execution: confirmedResult().execution,
    audit: confirmedResult().audit,
  });

  expect(runAutomatedExecution).toHaveBeenCalledOnce();
  const call = runAutomatedExecution.mock.calls[0];
  if (!call) throw new TypeError("expected one automated execution");
  const [intent, dependencies] = call;
  expect(intent).toMatchObject({
    chainId: request.chainId,
    strategy: demoStrategy,
    amountIn: "500001",
    agentMinOut: "750002",
  });
  const route = decodeFunctionData({ abi: venueAbi, data: intent.routeData });
  expect(route.args[0]).toBe(500001n);
  expect(route.args[1]).toBe(750002n);
  expect(route.args[2].toLowerCase()).toBe(request.mandateApp);
  expect(BigInt(intent.executionDeadline)).toBeGreaterThan(BigInt(now.getTime() / 1_000));
  expect(BigInt(intent.executionDeadline)).toBeLessThan(BigInt(demoStrategy.validUntil));
  expect(dependencies.policy).toMatchObject({
    chainId: request.chainId,
    mandateApp: request.mandateApp,
    signer: profile.agent.address,
    strategyHash: demoSnapshot.strategyHash,
    tokenIn: profile.tokenIn.address,
    tokenOut: profile.tokenOut.address,
    routeTarget: profile.route.target,
    routeSelector: profile.route.selector,
    routeRecipient: request.mandateApp,
    maxInputTotal: "3000000",
  });
});

it.each([
  ["wrong chain", { request: { chainId: "1", strategyHash: demoSnapshot.strategyHash } }],
  [
    "wrong agent",
    { snapshot: { ...demoSnapshot, strategy: { ...demoStrategy, agent: address("9") } } },
  ],
  [
    "wrong ENS",
    { snapshot: { ...demoSnapshot, ens: { ...demoSnapshot.ens, address: address("9") } } },
  ],
  [
    "wrong token pair",
    { snapshot: { ...demoSnapshot, strategy: { ...demoStrategy, tokenOut: address("9") } } },
  ],
  [
    "wrong route",
    { snapshot: { ...demoSnapshot, strategy: { ...demoStrategy, swapTarget: address("9") } } },
  ],
  [
    "expired authority",
    { snapshot: { ...demoSnapshot, strategy: { ...demoStrategy, validUntil: "1893456000" } } },
  ],
  [
    "strategy cap above the configured demo maximum",
    { snapshot: { ...demoSnapshot, strategy: { ...demoStrategy, maxInputTotal: "3000001" } } },
  ],
  [
    "untrusted transaction field",
    { request: { chainId: request.chainId, strategyHash: demoSnapshot.strategyHash, data: "0x" } },
  ],
])("fails closed for %s without invoking the signer", async (_name, mutation) => {
  const currentSnapshot = "snapshot" in mutation ? mutation.snapshot : demoSnapshot;
  const { service, runAutomatedExecution } = createService(currentSnapshot);
  const rawRequest =
    "request" in mutation
      ? mutation.request
      : { chainId: request.chainId, strategyHash: currentSnapshot.strategyHash };

  await expect(service.execute(rawRequest)).resolves.toMatchObject({ status: "REJECTED" });
  expect(runAutomatedExecution).not.toHaveBeenCalled();
});

it("returns an opaque unknown result and secret-free stage log when a dependency fails", async () => {
  const sensitiveMarker = "forbidden-sensitive-marker";
  const logs: unknown[] = [];
  const { service, runAutomatedExecution } = createService(
    demoSnapshot,
    new Error(`authority failed with ${sensitiveMarker}`),
    (entry) => logs.push(entry),
  );

  const result = await service.execute({
    chainId: request.chainId,
    strategyHash: demoSnapshot.strategyHash,
  });

  expect(result).toMatchObject({ status: "UNKNOWN" });
  expect(logs).toHaveLength(1);
  expect(logs[0]).toMatchObject({
    event: "demo-execution-unknown",
    stage: "READ_AUTHORITY",
  });
  expect(logs[0]).toMatchObject({
    errorTypes: ["Error"],
  });
  const logged = logs[0];
  if (!logged || typeof logged !== "object" || !("errorId" in logged)) {
    throw new TypeError("missing opaque error id");
  }
  expect(logged.errorId).toMatch(/^0x[0-9a-f]{64}$/);
  expect(JSON.stringify({ result, logs })).not.toContain(sensitiveMarker);
  expect(runAutomatedExecution).not.toHaveBeenCalled();
});
