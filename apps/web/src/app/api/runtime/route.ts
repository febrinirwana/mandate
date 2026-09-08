import { runtimeConfig } from "@/lib/runtime.server";

export function GET() {
  const runtime = runtimeConfig();
  if (!runtime) return Response.json({ error: "Mandate runtime is not configured" }, { status: 503 });
  return Response.json(runtime, { headers: { "cache-control": "no-store" } });
}
