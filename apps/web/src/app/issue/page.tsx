import type { Metadata } from "next";

import { Footer } from "@/components/landing/footer";
import { Nav } from "@/components/landing/nav";
import { Issuance } from "@/components/mandate/issuance";
import { runtimeConfig } from "@/lib/runtime.server";

export const metadata: Metadata = {
  title: "Mandate: Issue authority",
  description: "Review, ship, and activate one exact StrategyV1 from the treasury owner wallet.",
};

export default function IssuePage() {
  return <><Nav /><main><Issuance runtime={runtimeConfig()} /></main><Footer /></>;
}
