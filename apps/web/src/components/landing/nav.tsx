import Image from "next/image";
import Link from "next/link";

const DEMO_HASH = "0x4a91f2c7d6b3e580a9c1d47fb0e2f53618d7c4a9e5b2f08371c6d9a42f8e0b5d";

export function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-rule bg-paper/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between border-x border-rule px-6 lg:px-10">
        <Link href="/" className="flex items-center gap-3" aria-label="Mandate home">
          <Image src="/mandate-logo.png" alt="Mandate" width={162} height={20} priority className="h-[19px] w-auto" />
          <span className="hidden h-4 w-px bg-rule sm:block" aria-hidden="true" />
          <span className="ledger-label hidden text-ink-3 sm:block">Signed operating orders</span>
        </Link>
        <nav className="flex items-center gap-6" aria-label="Primary">
          <Link
            href={`/mandates/${DEMO_HASH}`}
            className="link-quiet hidden text-[0.9375rem] text-ink-2 hover:text-ink md:block"
          >
            Inspect demo
          </Link>
          <a href="#invariants" className="link-quiet hidden text-[0.9375rem] text-ink-2 hover:text-ink md:block">
            Invariants
          </a>
          <a
            href="https://github.com/1inch/aqua"
            target="_blank"
            rel="noreferrer"
            className="link-quiet hidden text-[0.9375rem] text-ink-2 hover:text-ink md:block"
          >
            Docs
          </a>
          <Link
            href={`/mandates/${DEMO_HASH}`}
            className="pressable inline-flex h-9 items-center rounded-[4px] bg-ink px-4 text-[0.875rem] font-medium text-paper hover:bg-ink-2 md:hidden"
          >
            Inspect demo
          </Link>
        </nav>
      </div>
    </header>
  );
}
