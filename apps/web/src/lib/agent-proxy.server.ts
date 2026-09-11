import "server-only";

import {
  DemoExecutionRequestV1Schema,
  DemoExecutionResultV1Schema,
  type DemoExecutionResultV1,
} from "@mandate/domain";

import { agentOrigin } from "@/lib/runtime.server";

export type AgentProxyState =
  | { kind: "READY"; data: DemoExecutionResultV1 }
  | { kind: "INVALID_REQUEST" }
  | { kind: "UNAVAILABLE" }
  | { kind: "INVALID_RESPONSE" };

export async function forwardDemoExecution(input: unknown): Promise<AgentProxyState> {
  const request = DemoExecutionRequestV1Schema.safeParse(input);
  if (!request.success) return { kind: "INVALID_REQUEST" };

  const origin = agentOrigin();
  if (!origin) return { kind: "UNAVAILABLE" };

  let response: Response;
  try {
    response = await fetch(`${origin}/v1/demo-executions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request.data),
      cache: "no-store",
      signal: AbortSignal.timeout(90_000),
    });
  } catch {
    return { kind: "UNAVAILABLE" };
  }
  if (!response.ok) return { kind: "UNAVAILABLE" };

  let value: unknown;
  try {
    value = await response.json();
  } catch {
    return { kind: "INVALID_RESPONSE" };
  }
  const result = DemoExecutionResultV1Schema.safeParse(value);
  return result.success ? { kind: "READY", data: result.data } : { kind: "INVALID_RESPONSE" };
}
