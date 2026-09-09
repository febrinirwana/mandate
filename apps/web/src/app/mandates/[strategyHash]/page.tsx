import type { Metadata } from "next";
import { Footer } from "@/components/landing/footer";
import { Nav } from "@/components/landing/nav";
import { MandateInspector } from "@/components/mandate/inspector";
import { runtimeConfig } from "@/lib/runtime.server";

export const metadata: Metadata = {
  title: "Mandate: Inspection",
  description:
    "Public, read-only authority inspection: who may act, on what, until when, and how to stop it.",
};

export default async function MandatePage({
  params,
}: {
  params: Promise<{ strategyHash: string }>;
}) {
  const { strategyHash } = await params;
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
        <MandateInspector hash={strategyHash} runtime={runtimeConfig()} />
      </main>
      <Footer />
    </>
  );
}
