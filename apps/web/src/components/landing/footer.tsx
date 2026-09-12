import Image from "next/image";

const COLS: { title: string; links: { label: string; href: string; external?: boolean }[] }[] = [
  {
    title: "Product",
    links: [
      {
        label: "Inspect demo mandate",
        href: "/mandates/0x01163a9088c3c0342fd7d8b07f4720c5d52e1c9626cc114923ae4339414f9fcd?tx=0x0d4174a636098d3b0f717cb2e71d721aa646d6cf43ca61f9ae1460c1df75f164",
      },
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
      {
        label: "Strategy fields",
        href: "/mandates/0x01163a9088c3c0342fd7d8b07f4720c5d52e1c9626cc114923ae4339414f9fcd?tx=0x0d4174a636098d3b0f717cb2e71d721aa646d6cf43ca61f9ae1460c1df75f164#fields",
      },
      {
        label: "Receipt plate",
        href: "/mandates/0x01163a9088c3c0342fd7d8b07f4720c5d52e1c9626cc114923ae4339414f9fcd?tx=0x0d4174a636098d3b0f717cb2e71d721aa646d6cf43ca61f9ae1460c1df75f164#receipt",
      },
    ],
  },
];

export function Footer() {
  return (
    <footer style={{ background: "var(--ink)", color: "var(--paper)" }}>
      <div className="mx-auto max-w-[1440px] px-6 pt-16 lg:px-10">
        <div
          className="grid gap-10 border-b pb-12 pt-2 sm:grid-cols-2 lg:grid-cols-[1.2fr_repeat(3,0.6fr)]"
          style={{ borderColor: "rgb(255 255 255 / 0.12)" }}
        >
          <div>
            <Image
              src="/mandate-logo-ivory.png"
              alt="Mandate"
              width={336}
              height={44}
              priority={false}
              className="h-8 w-auto"
            />
            <p className="mono-data mt-5 max-w-[38ch]" style={{ color: "rgb(255 255 255 / 0.55)" }}>
              A signed operating order for treasury agents. Authority before autonomy.
            </p>
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

        <div
          className="mono-data flex flex-wrap items-center justify-between gap-3 border-t py-6"
          style={{ borderColor: "rgb(255 255 255 / 0.12)", color: "rgb(255 255 255 / 0.45)" }}
        >
          <span>Built for ETHOnline 2026 · 1inch Aqua track</span>
          <span>Sample data throughout · unknown fails closed</span>
          <span>© 2026 Mandate</span>
        </div>
      </div>
    </footer>
  );
}
