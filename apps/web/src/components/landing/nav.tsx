import { Wordmark } from "@/components/brand/wordmark";
import { ThemeToggle } from "@/components/theme";

export function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-rule bg-paper/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between border-x border-rule px-6 lg:px-10">
        <a href="/" className="flex items-center gap-3" aria-label="Mandate home">
          <Wordmark className="h-5 w-15" />
          <span className="hidden h-4 w-px bg-rule sm:block" aria-hidden="true" />
          <span className="ledger-label hidden text-ink-3 sm:block">Signed operating orders</span>
        </a>
        <nav className="flex items-center gap-6" aria-label="Primary">
          <a href="/mandates/0x4a91f2c7d6b3e580a9c1d47fb0e2f53618d7c4a9e5b2f08371c6d9a42f8e0b5d" className="link-quiet hidden text-[0.9375rem] text-ink-2 hover:text-ink md:block">
            Inspect demo
          </a>
          <a href="#invariants" className="link-quiet hidden text-[0.9375rem] text-ink-2 hover:text-ink md:block">
            Invariants
          </a>
          <a href="https://github.com/1inch/aqua" target="_blank" rel="noreferrer" className="link-quiet hidden text-[0.9375rem] text-ink-2 hover:text-ink md:block">
            Docs
          </a>
          <span className="hidden h-5 w-px bg-rule md:block" aria-hidden="true" />
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
