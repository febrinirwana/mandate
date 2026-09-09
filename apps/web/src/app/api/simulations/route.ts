import { proxyMandateApi } from "@/lib/api-proxy.server";

export async function POST(request: Request) {
  return proxyMandateApi(request, "/v1/simulations");
}
