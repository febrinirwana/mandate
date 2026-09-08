import { proxyMandateApi } from "@/lib/api-proxy.server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ chainId: string; strategyHash: string }> },
) {
  const { chainId, strategyHash } = await params;
  return proxyMandateApi(request, `/v1/mandates/${encodeURIComponent(chainId)}/${encodeURIComponent(strategyHash)}`);
}
