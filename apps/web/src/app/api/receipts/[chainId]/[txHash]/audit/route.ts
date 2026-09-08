import { proxyMandateApi } from "@/lib/api-proxy.server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ chainId: string; txHash: string }> },
) {
  const { chainId, txHash } = await params;
  return proxyMandateApi(
    request,
    `/v1/receipts/${encodeURIComponent(chainId)}/${encodeURIComponent(txHash)}/audit`,
  );
}
