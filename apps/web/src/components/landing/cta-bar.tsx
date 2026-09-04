import { ArrowUpRight as PhArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { ButtonLink } from "@/components/ui/kit";

const DEMO_HASH = "0x4a91f2c7d6b3e580a9c1d47fb0e2f53618d7c4a9e5b2f08371c6d9a42f8e0b5d";

export function CtaBar() {
  return (
    <section aria-label="Get started" style={{ background: "var(--ink)" }}>
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-6 px-6 py-14 lg:px-10">
        <h2 className="display max-w-[22ch] text-[clamp(1.75rem,3.4vw,3rem)]" style={{ color: "var(--paper)" }}>
          Issue your first mandate on Sepolia.
        </h2>
        <ButtonLink
          href={`/mandates/${DEMO_HASH}`}
          variant="primary"
          className="h-14 rounded-full px-8 text-[1rem]"
          aria-label="Open the demo mandate inspection"
        >
          Inspect the demo
          <span
            className="grid h-8 w-8 place-items-center rounded-full"
            style={{ background: "rgb(255 255 255 / 0.16)" }}
            aria-hidden="true"
          >
            <PhArrowUpRight size={14} weight="bold" />
          </span>
        </ButtonLink>
      </div>
    </section>
  );
}
