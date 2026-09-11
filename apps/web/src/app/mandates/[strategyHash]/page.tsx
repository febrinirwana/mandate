import type { Metadata } from "next";
import { Footer } from "@/components/landing/footer";
import { Nav } from "@/components/landing/nav";
import { MandateInspector } from "@/components/mandate/inspector";
import { loadBazanticProof } from "@/lib/bazantic-proof.server";
import { runtimeConfig } from "@/lib/runtime.server";

export const metadata: Metadata = {
  title: "Mandate: Inspection",
  description:
    "Public, read-only authority inspection: who may act, on what, until when, and how to stop it.",
};

export default async function MandatePage({
  params,
  searchParams,
}: {
  params: Promise<{ strategyHash: string }>;
  searchParams: Promise<{
    tx?: string | string[];
    activationTx?: string | string[];
    justIssued?: string | string[];
  }>;
}) {
  const [{ strategyHash }, query] = await Promise.all([params, searchParams]);
  const rawTx = query.tx;
  const initialTxHash =
    typeof rawTx === "string" && /^0x[0-9a-fA-F]{64}$/.test(rawTx)
      ? (rawTx.toLowerCase() as `0x${string}`)
      : undefined;
  const rawActivationTx = query.activationTx;
  const activationTx =
    typeof rawActivationTx === "string" && /^0x[0-9a-fA-F]{64}$/.test(rawActivationTx)
      ? (rawActivationTx.toLowerCase() as `0x${string}`)
      : undefined;
  const justIssued = query.justIssued === "1";
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-[4px] focus:bg-accent focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <Nav />
      <main id="main">
        <MandateInspector
          hash={strategyHash}
          runtime={runtimeConfig()}
          initialTxHash={initialTxHash}
          justIssued={justIssued}
          activationTx={activationTx}
          bazanticProof={loadBazanticProof()}
        />
      </main>
      <Footer />
    </>
  );
}
