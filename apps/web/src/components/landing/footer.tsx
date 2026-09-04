"use client";

import { useMemo } from "react";
import { Halftone } from "@/components/dot/halftone";
import { Wordmark } from "@/components/brand/wordmark";
import { ThemeToggle } from "@/components/theme";
import { useTheme } from "@/components/theme";

const COLS: { title: string; links: { label: string; href: string; external?: boolean }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Inspect demo mandate", href: "/mandates/0x4a91f2c7d6b3e580a9c1d47fb0e2f53618d7c4a9e5b2f08371c6d9a42f8e0b5d" },
      { label: "How a mandate works", href: "/#how" },
      { label: "Invariants", href: "/#invariants" },
    ],
  },
  {
    title: "Protocol",
    links: [
      { label: "1inch Aqua", href: "https://1inch.com/aqua", external: true },
      { label: "ENSv2", href: "https://docs.ens.domains/ensv2/overview", external: true },
      { label: "Aqua repository", href: "https://github.com/1inch/aqua", external: true },
    ],
  },
  {
    title: "Evidence",
    links: [
      { label: "Strategy fields", href: "/mandates/0x4a91f2c7d6b3e580a9c1d47fb0e2f53618d7c4a9e5b2f08371c6d9a42f8e0b5d#fields" },
      { label: "Receipt plate", href: "/mandates/0x4a91f2c7d6b3e580a9c1d47fb0e2f53618d7c4a9e5b2f08371c6d9a42f8e0b5d#receipt" },
    ],
  },
];

export function Footer() {
  const { theme } = useTheme();
  const palette = useMemo(
    () => (theme === "dark" ? { base: "#33333b", accent: "#a6a8b8" } : { base: "#45433c", accent: "#ecebe4" }),
    [theme],
  );

  return (
    <footer style={{ background: "var(--ink)", color: "var(--paper)" }}>
      <div className="mx-auto max-w-[1440px] px-6 pt-16 lg:px-10">
        {/* giant halftone wordmark — the brand rendered as its own material */}
        <Halftone
          draw={() => {}}
          imageSrc="/mandate-logo.png"
          palette={palette}
          cell={4}
          entry={false}
          parallax={0}
          className="mx-auto h-[9vw] max-h-[150px] min-h-[64px] w-full max-w-[1080px]"
        />

        <div className="mt-14 grid gap-10 border-t pb-12 pt-10 sm:grid-cols-2 lg:grid-cols-[1.2fr_repeat(3,0.6fr)]" style={{ borderColor: "rgb(255 255 255 / 0.12)" }}>
          <div>
            <Wordmark className="h-6 w-18" />
            <p className="mono-data mt-4 max-w-[38ch]" style={{ color: "rgb(255 255 255 / 0.55)" }}>
              A signed operating order for treasury agents. Authority before autonomy.
            </p>
            <div className="mt-6">
              <ThemeToggle />
            </div>
          </div>
          {COLS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <div className="ledger-label" style={{ color: "rgb(255 255 255 / 0.45)" }}>
                {col.title}
              </div>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      {...(l.external ? { target: "_blank", rel: "noreferrer" } : {})}
                      className="link-quiet text-[0.9375rem]"
                      style={{ color: "rgb(255 255 255 / 0.78)" }}
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mono-data flex flex-wrap items-center justify-between gap-3 border-t py-6" style={{ borderColor: "rgb(255 255 255 / 0.12)", color: "rgb(255 255 255 / 0.45)" }}>
          <span>Built for ETHOnline 2026 — 1inch Aqua track</span>
          <span>Sample data throughout · unknown fails closed</span>
          <span>© 2026 Mandate</span>
        </div>
      </div>
    </footer>
  );
}
