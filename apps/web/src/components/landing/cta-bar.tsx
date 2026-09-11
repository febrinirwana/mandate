import { ArrowUpRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/kit";

const DEMO_URL =
  "/mandates/0x01163a9088c3c0342fd7d8b07f4720c5d52e1c9626cc114923ae4339414f9fcd?tx=0x0d4174a636098d3b0f717cb2e71d721aa646d6cf43ca61f9ae1460c1df75f164";

export function CtaBar() {
  return (
    <section aria-label="Get started" style={{ background: "var(--ink)" }}>
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-6 px-6 py-14 lg:px-10">
        <h2
          className="display max-w-[22ch] text-[clamp(1.75rem,3.4vw,3rem)]"
          style={{ color: "var(--paper)" }}
        >
          Issue your first mandate on Sepolia.
        </h2>
        <ButtonLink
          href={DEMO_URL}
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
            <ArrowUpRight size={14} strokeWidth={2.5} />
          </span>
        </ButtonLink>
      </div>
    </section>
  );
}
