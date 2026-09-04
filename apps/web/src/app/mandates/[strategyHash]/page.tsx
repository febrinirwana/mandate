import type { Metadata } from "next";
import { MandateInspector } from "@/components/mandate/inspector";
import { Footer } from "@/components/landing/footer";
import { Nav } from "@/components/landing/nav";
import { DEMO_STRATEGY_HASH } from "@/lib/demo";

export const metadata: Metadata = {
  title: "Mandate — Inspection",
  description: "Public, read-only authority inspection: who may act, on what, until when, and how to stop it.",
};

export default async function MandatePage({ params }: { params: Promise<{ strategyHash: string }> }) {
  const { strategyHash } = await params;
  const canonical = strategyHash?.toLowerCase() === DEMO_STRATEGY_HASH;
  const wellFormed = !!strategyHash?.match(/^0x[0-9a-fA-F]{64}$/);
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
        <MandateInspector hash={strategyHash} resolved={canonical || wellFormed} />
      </main>
      <Footer />
    </>
  );
}
