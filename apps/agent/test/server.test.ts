import { once } from "node:events";
import type { AddressInfo } from "node:net";

import { afterEach, expect, it, vi } from "vitest";

import { createDemoExecutionServer, listenDemoExecutionServer } from "../src/server.js";

const hash = (digit: string) => `0x${digit.repeat(64)}`;
const request = { chainId: "11155111", strategyHash: hash("1") };
const servers: Array<{ close(callback: (error?: Error) => void): void }> = [];

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map(
        (server) =>
          new Promise<void>((resolve, reject) =>
            server.close((error) => (error ? reject(error) : resolve())),
          ),
      ),
  );
});

async function start(options: Parameters<typeof createDemoExecutionServer>[0]) {
  const server = createDemoExecutionServer(options);
  servers.push(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

it("binds the standalone demo server to loopback by default", async () => {
  const execute = vi.fn();
  const server = listenDemoExecutionServer({ demoEnabled: true, service: { execute } }, 0);
  servers.push(server);
  await once(server, "listening");

  const address = server.address() as AddressInfo;
  expect(address.address).toBe("127.0.0.1");
});

it("accepts only the strict demo request and returns the canonical service result", async () => {
  const execute = vi.fn().mockResolvedValue({ status: "REJECTED", reason: "MANDATE_REVOKED" });
  const origin = await start({ demoEnabled: true, service: { execute } });

  const response = await fetch(`${origin}/v1/demo-executions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });

  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  await expect(response.json()).resolves.toEqual({ status: "REJECTED", reason: "MANDATE_REVOKED" });
  expect(execute).toHaveBeenCalledExactlyOnceWith(request);
});

it("rejects invalid JSON, untrusted transaction fields, and oversized bodies before service execution", async () => {
  const execute = vi.fn();
  const origin = await start({ demoEnabled: true, service: { execute } });

  for (const body of [
    "{",
    JSON.stringify({ ...request, to: `0x${"2".repeat(40)}` }),
    JSON.stringify({ ...request, padding: "x".repeat(64 * 1024) }),
  ]) {
    const response = await fetch(`${origin}/v1/demo-executions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
    await expect(response.json()).resolves.toMatchObject({ status: "REJECTED" });
  }

  expect(execute).not.toHaveBeenCalled();
});

it("reports disabled demo mode as an unavailable safe state without calling the service", async () => {
  const execute = vi.fn();
  const origin = await start({ demoEnabled: false, service: { execute } });

  const response = await fetch(`${origin}/v1/demo-executions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });

  expect(response.status).toBe(503);
  await expect(response.json()).resolves.toMatchObject({ status: "UNKNOWN" });
  expect(execute).not.toHaveBeenCalled();
});

it("requires the configured server credential before executing a public demo request", async () => {
  const execute = vi.fn().mockResolvedValue({ status: "REJECTED", reason: "MANDATE_REVOKED" });
  const origin = await start({
    authToken: "server-only-agent-token",
    demoEnabled: true,
    service: { execute },
  });

  for (const authorization of [undefined, "Bearer wrong-token"]) {
    const response = await fetch(`${origin}/v1/demo-executions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(authorization ? { authorization } : {}),
      },
      body: JSON.stringify(request),
    });
    expect(response.status).toBe(401);
  }

  expect(execute).not.toHaveBeenCalled();

  const response = await fetch(`${origin}/v1/demo-executions`, {
    method: "POST",
    headers: {
      authorization: "Bearer server-only-agent-token",
      "content-type": "application/json",
    },
    body: JSON.stringify(request),
  });
  expect(response.status).toBe(200);
  expect(execute).toHaveBeenCalledExactlyOnceWith(request);
});

it("does not expose configured secrets in unexpected error responses or logs", async () => {
  const sensitiveMarker = "forbidden-sensitive-marker";
  const keystore = '{"encrypted":"test-keystore-content"}';
  const logs: string[] = [];
  const origin = await start({
    demoEnabled: true,
    service: {
      execute: vi.fn().mockRejectedValue(new Error(`failed with ${sensitiveMarker} ${keystore}`)),
    },
    logger: (entry: unknown) => logs.push(JSON.stringify(entry)),
  });

  const response = await fetch(`${origin}/v1/demo-executions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });
  const body = await response.text();

  expect(response.status).toBe(500);
  expect(body).toContain('"status":"UNKNOWN"');
  expect(body).not.toContain(sensitiveMarker);
  expect(body).not.toContain(keystore);
  expect(logs.join("\n")).not.toContain(sensitiveMarker);
  expect(logs.join("\n")).not.toContain(keystore);
});

it("reports health without invoking signing or execution dependencies", async () => {
  const execute = vi.fn();
  const origin = await start({ demoEnabled: true, service: { execute } });

  const response = await fetch(`${origin}/health`);

  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  await expect(response.json()).resolves.toEqual({ status: "ok" });
  expect(execute).not.toHaveBeenCalled();
});
