import { describe, expect, it, vi } from "vitest";

import { createApp } from "../src/app.js";

const hash = (digit: string) => `0x${digit.repeat(64)}` as const;
const address = (digit: string) => `0x${digit.repeat(40)}` as const;

const snapshot = {
  version: 1 as const,
  chainId: "11155111",
  strategyHash: hash("1"),
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

const services = {
  readMandate: vi.fn().mockResolvedValue(snapshot),
  simulate: vi.fn(),
  readExecution: vi.fn(),
  auditReceipt: vi.fn(),
};

describe("Mandate API", () => {
  it("exposes generated OpenAPI for exactly four versioned operations", async () => {
    const response = await createApp(services).request("/openapi.json");
    const document = (await response.json()) as { paths: Record<string, unknown> };

    expect(response.status).toBe(200);
    expect(Object.keys(document.paths)).toEqual([
      "/v1/mandates/{chainId}/{strategyHash}",
      "/v1/simulations",
      "/v1/executions/{chainId}/{txHash}",
      "/v1/receipts/{chainId}/{txHash}/audit",
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
