import "server-only";

import { apiOrigin } from "@/lib/runtime.server";

const FORWARDED_HEADERS = ["content-type", "x-request-id"] as const;

export async function proxyMandateApi(request: Request, path: string): Promise<Response> {
  try {
    const upstream = await fetch(new URL(path, apiOrigin()), {
      method: request.method,
      headers: request.method === "POST" ? { "content-type": "application/json" } : undefined,
      body: request.method === "POST" ? await request.text() : undefined,
      cache: "no-store",
    });
    const headers = new Headers({ "cache-control": "no-store" });
    for (const name of FORWARDED_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch {
    return Response.json({ error: "Mandate API unavailable" }, { status: 503 });
  }
}
