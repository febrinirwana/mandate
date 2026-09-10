import { describe, expect, it, vi } from "vitest";

import { createApp } from "../src/app.js";

const hash = (digit: string) => `0x${digit.repeat(64)}` as const;
const address = (digit: string) => `0x${digit.repeat(40)}` as const;

const snapshot = {
  version: 1 as const,
  chainId: "11155111",
  strategyHash: hash("1"),
  strategy: {
    version: 1 as const,
    maker: address("3"),
    agent: address("4"),
    ensRegistry: address("5"),
    ensResolver: address("6"),
    ensLabel: "agent",
    ensNode: hash("7"),
    tokenIn: address("8"),
    tokenOut: address("9"),
    swapTarget: address("a"),
    swapSelector: "0x12345678" as const,
    minRateNumerator: "1",
    minRateDenominator: "1",
    maxInputPerCall: "1",
    maxInputTotal: "1",
    validAfter: "1",
    validUntil: "2",
    salt: hash("b"),
  },
  aqua: {
    address: address("c"),
    result: "PASS" as const,
    inputBalance: "1",
    outputBalance: "0",
  },
  physical: {
    result: "PASS" as const,
    makerTokenIn: "1",
    makerTokenOut: "0",
    agentTokenIn: "0",
    agentTokenOut: "0",
    appTokenIn: "0",
    appTokenOut: "0",
  },
  block: { number: "1", hash: hash("2") },
  state: { maker: address("3"), usedInput: "0", activated: true, revoked: false },
  ens: {
    status: "REGISTERED",
    tokenId: "1",
    owner: address("4"),
    expiry: "2000000000",
    address: address("4"),
  },
  result: "PASS" as const,
};

const routeRequest = {
  version: 1 as const,
  chainId: "1" as const,
  mandateApp: address("a"),
  strategy: {
    ...snapshot.strategy,
    tokenIn: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    tokenOut: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    swapTarget: "0x111111125421ca6dc452d289314280a0f8842a65",
    swapSelector: "0x07ed2379" as const,
    maxInputPerCall: "100000000000000000",
    maxInputTotal: "100000000000000000",
    validAfter: "1789000000",
    validUntil: "1789005600",
  },
  amountIn: "100000000000000000",
  agentMinOut: "1",
  executionDeadline: "1789002300",
  protocols: ["UNISWAP_V3"],
  provider: {
    status: "UNAVAILABLE" as const,
    observedAt: "2026-09-10T01:00:00.000Z",
    reason: "TIMEOUT" as const,
  },
};

const routeAssessment = {
  version: 1 as const,
  result: "UNKNOWN" as const,
  reasons: ["ONEINCH_UNAVAILABLE" as const],
  chainId: "1" as const,
  strategyHash: hash("c"),
  assessedAt: "2026-09-10T01:00:01.000Z",
  request: {
    mandateApp: routeRequest.mandateApp,
    amountIn: routeRequest.amountIn,
    agentMinOut: routeRequest.agentMinOut,
    executionDeadline: routeRequest.executionDeadline,
  },
  route: null,
  checks: [{ code: "PROVIDER_RESPONSE" as const, result: "UNKNOWN" as const }],
  evidence: [
    { provider: "1inch-classic-swap-v6.1" as const, responseHash: hash("d") },
    { provider: "mandate-strategy" as const, responseHash: hash("c") },
  ],
};

const services = {
  readMandate: vi.fn().mockResolvedValue(snapshot),
  simulate: vi.fn(),
  readExecution: vi.fn(),
  auditReceipt: vi.fn(),
  assessRoute: vi.fn().mockResolvedValue(routeAssessment),
};

describe("Mandate API", () => {
  it("exposes generated OpenAPI for exactly five versioned operations", async () => {
    const response = await createApp(services).request("/openapi.json");
    const document = (await response.json()) as { paths: Record<string, unknown> };

    expect(response.status).toBe(200);
    expect(Object.keys(document.paths)).toEqual([
      "/v1/mandates/{chainId}/{strategyHash}",
      "/v1/simulations",
      "/v1/executions/{chainId}/{txHash}",
      "/v1/receipts/{chainId}/{txHash}/audit",
      "/v1/routes/1inch/assess",
    ]);
  });

  it("validates route inputs and propagates a structured request ID", async () => {
    const app = createApp(services);
    const invalid = await app.request(`/v1/mandates/not-a-chain/${hash("1")}`);
    const valid = await app.request(`/v1/mandates/11155111/${hash("1")}`, {
      headers: { "x-request-id": "req-12345678" },
    });

    expect(invalid.status).toBe(400);
    expect(valid.status).toBe(200);
    expect(valid.headers.get("x-request-id")).toBe("req-12345678");
    expect(await valid.json()).toEqual(snapshot);
  });

  it("returns a schema-bound route assessment without upgrading provider uncertainty", async () => {
    const response = await createApp(services).request("/v1/routes/1inch/assess", {
      method: "POST",
      headers: { "content-type": "application/json", "x-request-id": "route-12345678" },
      body: JSON.stringify(routeRequest),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBe("route-12345678");
    expect(await response.json()).toEqual(routeAssessment);
    expect(services.assessRoute).toHaveBeenCalledWith(routeRequest);

    const invalid = await createApp(services).request("/v1/routes/1inch/assess", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...routeRequest, chainId: "11155111" }),
    });
    expect(invalid.status).toBe(400);
  });

  it("caps request bodies before parsing", async () => {
    const response = await createApp(services, { maxBodyBytes: 32 }).request("/v1/simulations", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": "33" },
      body: JSON.stringify({ value: "x".repeat(40) }),
    });

    expect(response.status).toBe(413);
  });

  it("redacts service errors that contain credentials", async () => {
    services.readMandate.mockRejectedValueOnce(
      new Error("postgresql://postgres.project:super-secret@pooler.supabase.com/postgres"),
    );
    const response = await createApp(services).request(`/v1/mandates/11155111/${hash("1")}`);
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(body).not.toContain("super-secret");
    expect(body).not.toContain("postgresql://");
  });

  it("bounds slow service calls", async () => {
    const never = new Promise<never>(() => undefined);
    const response = await createApp(
      { ...services, readMandate: vi.fn(() => never) },
      { timeoutMs: 5 },
    ).request(`/v1/mandates/11155111/${hash("1")}`);

    expect(response.status).toBe(504);
  });
});
