import { forwardDemoExecution } from "@/lib/agent-proxy.server";

export async function POST(request: Request): Promise<Response> {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return Response.json(
      { kind: "INVALID_REQUEST" },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json(
      { kind: "INVALID_REQUEST" },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  const result = await forwardDemoExecution(input);
  if (result.kind === "READY") {
    return Response.json(result.data, { headers: { "cache-control": "no-store" } });
  }
  if (result.kind === "INVALID_REQUEST") {
    return Response.json(
      { kind: "INVALID_REQUEST" },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }
  return Response.json(
    {
      status: "UNKNOWN",
      errorId: result.kind === "UNAVAILABLE" ? "AGENT_UNAVAILABLE" : "AGENT_RESPONSE_INVALID",
    },
    { status: result.kind === "UNAVAILABLE" ? 503 : 502, headers: { "cache-control": "no-store" } },
  );
}
