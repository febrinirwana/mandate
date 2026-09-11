import {
  DemoExecutionRequestV1Schema,
  DemoExecutionResultV1Schema,
  ExecutionV1Schema,
  MandateSnapshotV1Schema,
  ReceiptAuditV1Schema,
  SimulationV1Schema,
  type DemoExecutionResultV1,
  type ExecutionV1,
  type MandateSnapshotV1,
  type ReceiptAuditV1,
  type SimulationRequestV1,
  type SimulationV1,
} from "@mandate/domain";

export type ApiState<T> =
  | { kind: "READY"; data: T }
  | { kind: "NOT_FOUND" }
  | { kind: "OUTAGE" }
  | { kind: "INVALID_RESPONSE" };

async function response(path: string, init?: RequestInit): Promise<Response | null> {
  try {
    return await fetch(path, { ...init, cache: "no-store" });
  } catch {
    return null;
  }
}

export async function readMandate(
  chainId: string,
  strategyHash: string,
): Promise<ApiState<MandateSnapshotV1>> {
  const value = await response(`/api/mandates/${chainId}/${strategyHash}`);
  if (!value) return { kind: "OUTAGE" };
  if (value.status === 404) return { kind: "NOT_FOUND" };
  if (!value.ok) return { kind: "OUTAGE" };
  const parsed = MandateSnapshotV1Schema.safeParse(await value.json());
  return parsed.success ? { kind: "READY", data: parsed.data } : { kind: "INVALID_RESPONSE" };
}

export async function simulate(requestBody: SimulationRequestV1): Promise<ApiState<SimulationV1>> {
  const value = await response("/api/simulations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(requestBody),
  });
  if (!value || !value.ok) return { kind: "OUTAGE" };
  const parsed = SimulationV1Schema.safeParse(await value.json());
  return parsed.success ? { kind: "READY", data: parsed.data } : { kind: "INVALID_RESPONSE" };
}

export async function runDemoAgent(input: unknown): Promise<ApiState<DemoExecutionResultV1>> {
  const request = DemoExecutionRequestV1Schema.safeParse(input);
  if (!request.success) return { kind: "INVALID_RESPONSE" };
  const value = await response("/api/agent-executions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request.data),
  });
  if (!value || !value.ok) return { kind: "OUTAGE" };
  let body: unknown;
  try {
    body = await value.json();
  } catch {
    return { kind: "INVALID_RESPONSE" };
  }
  const parsed = DemoExecutionResultV1Schema.safeParse(body);
  return parsed.success ? { kind: "READY", data: parsed.data } : { kind: "INVALID_RESPONSE" };
}

export async function readExecution(
  chainId: string,
  txHash: string,
): Promise<ApiState<ExecutionV1>> {
  const value = await response(`/api/executions/${chainId}/${txHash}`);
  if (!value) return { kind: "OUTAGE" };
  if (value.status === 404) return { kind: "NOT_FOUND" };
  if (!value.ok) return { kind: "OUTAGE" };
  const parsed = ExecutionV1Schema.safeParse(await value.json());
  return parsed.success ? { kind: "READY", data: parsed.data } : { kind: "INVALID_RESPONSE" };
}

export async function readAudit(
  chainId: string,
  txHash: string,
): Promise<ApiState<ReceiptAuditV1>> {
  const value = await response(`/api/receipts/${chainId}/${txHash}/audit`);
  if (!value) return { kind: "OUTAGE" };
  if (value.status === 404) return { kind: "NOT_FOUND" };
  if (!value.ok) return { kind: "OUTAGE" };
  const parsed = ReceiptAuditV1Schema.safeParse(await value.json());
  return parsed.success ? { kind: "READY", data: parsed.data } : { kind: "INVALID_RESPONSE" };
}

export type { ExecutionV1, MandateSnapshotV1, ReceiptAuditV1, SimulationV1 };
