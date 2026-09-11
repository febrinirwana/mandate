import type { Metadata } from "next";

import { Footer } from "@/components/landing/footer";
import { Nav } from "@/components/landing/nav";
import { Issuance } from "@/components/mandate/issuance";
import { MandateProviders } from "@/components/providers";
import { runtimeConfig } from "@/lib/runtime.server";

export const metadata: Metadata = {
  title: "Mandate: Issue authority",
  description: "Review, ship, and activate one exact StrategyV1 from the treasury owner wallet.",
};

export default function IssuePage() {
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
        <MandateProviders>
          <Issuance runtime={runtimeConfig()} />
        </MandateProviders>
      </main>
      <Footer />
    </>
  );
}
