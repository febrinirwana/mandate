import { BuiltOn } from "@/components/landing/built-on";
import { Chapters } from "@/components/landing/chapters";
import { CtaBar } from "@/components/landing/cta-bar";
import { Footer } from "@/components/landing/footer";
import { Hero } from "@/components/landing/hero";
import { Invariants } from "@/components/landing/invariants";
import { LiveLedger } from "@/components/landing/live-ledger";
import { Nav } from "@/components/landing/nav";
import { Statements } from "@/components/landing/statements";

export default function LandingPage() {
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
        <Hero />
        <Statements />
        <Chapters />
        <LiveLedger />
        <Invariants />
        <BuiltOn />
        <CtaBar />
      </main>
      <Footer />
    </>
  );
}
