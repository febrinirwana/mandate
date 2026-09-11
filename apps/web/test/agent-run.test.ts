import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "../src/app/api/agent-executions/route";
import { parseInitialReceiptHash, toAgentRunState } from "../src/components/mandate/agent-run";
import { runDemoAgent } from "../src/lib/api";

const address = (digit: string): `0x${string}` => `0x${digit.repeat(40)}`;
const hash = (digit: string): `0x${string}` => `0x${digit.repeat(64)}`;
const chainId = "11155111";
const strategyHash = hash("1");

const confirmed = {
  status: "CONFIRMED" as const,
  txHash: hash("2"),
  execution: {
    version: 1 as const,
    chainId,
    txHash: hash("2"),
    block: { number: "12", hash: hash("3") },
    transactionIndex: "0",
    strategyHash,
    caller: address("4"),
    amountIn: "1000000",
    amountOut: "1000000000000000000",
    usedInputAfter: "1000000",
    status: "CONFIRMED" as const,
  },
  audit: {
    version: 1 as const,
    result: "COMPLIANT" as const,
    chainId,
    txHash: hash("2"),
    block: { number: "12", hash: hash("3") },
    strategyHash,
    checks: [{ code: "CALLER_NOT_AGENT" as const, result: "PASS" as const }],
    evidence: [{ provider: "receipt-indexer", responseHash: hash("5") }],
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.MANDATE_AGENT_ORIGIN;
});

describe("automated agent run", () => {
  it("accepts only a canonical agent response and fails closed for a malformed success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(confirmed))));

    await expect(runDemoAgent({ chainId, strategyHash })).resolves.toEqual({
      kind: "READY",
      data: confirmed,
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...confirmed, txHash: hash("6") }))),
    );
    await expect(runDemoAgent({ chainId, strategyHash })).resolves.toEqual({
      kind: "INVALID_RESPONSE",
    });
  });

  it("forwards only the strict browser request to the fixed agent origin", async () => {
    process.env.MANDATE_AGENT_ORIGIN = "http://agent.internal:3002";
    const upstream = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : input instanceof URL ? input.href : input;
      expect(url).toBe("http://agent.internal:3002/v1/demo-executions");
      expect(init?.method).toBe("POST");
      expect(await new Response(init?.body).json()).toEqual({ chainId, strategyHash });
      const headers = new Headers(init?.headers);
      expect(headers.get("content-type")).toBe("application/json");
      expect(headers.get("authorization")).toBeNull();
      expect(headers.get("cookie")).toBeNull();
      return new Response(JSON.stringify(confirmed));
    });
    vi.stubGlobal("fetch", upstream);

    const response = await POST(
      new Request("http://localhost/api/agent-executions", {
        method: "POST",
        headers: {
          authorization: "Bearer browser-token",
          cookie: "session=browser-cookie",
          "content-type": "application/json",
          "x-forwarded-for": "198.51.100.1",
        },
        body: JSON.stringify({ chainId, strategyHash }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(confirmed);
    expect(upstream).toHaveBeenCalledOnce();
  });

  it("rejects extra browser transaction fields before they can reach the agent", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);

    const response = await POST(
      new Request("http://localhost/api/agent-executions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chainId, strategyHash, to: address("9") }),
      }),
    );

    expect(response.status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("restores only a valid receipt transaction query and keeps rejected or unknown runs non-passing", () => {
    expect(parseInitialReceiptHash(confirmed.txHash)).toBe(confirmed.txHash);
    expect(parseInitialReceiptHash("0x1234")).toBeUndefined();
    expect(toAgentRunState({ kind: "READY", data: confirmed })).toBe("PASS");
    expect(
      toAgentRunState({ kind: "READY", data: { status: "REJECTED", reason: "MANDATE_REVOKED" } }),
    ).toBe("FAIL");
    expect(
      toAgentRunState({ kind: "READY", data: { status: "UNKNOWN", errorId: hash("7") } }),
    ).toBe("UNKNOWN");
    expect(toAgentRunState({ kind: "INVALID_RESPONSE" })).toBe("UNKNOWN");
  });
});
