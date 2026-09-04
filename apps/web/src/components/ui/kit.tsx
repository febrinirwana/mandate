import { ArrowUpRight as PhArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, CSSProperties, ReactNode, Ref } from "react";
import { STAMP_STYLE, type StampKind } from "@/lib/demo";

/* ---------------------------------------------------------------- */
/* State stamp — a printed mark: dot, label, tinted ground.          */
/* ----------------------------------------------------------------- */

export function Stamp({ kind, label, className }: { kind: StampKind; label?: string; className?: string }) {
  const s = STAMP_STYLE[kind];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[2px] px-1.5 py-0.5 ${className ?? ""}`}
      style={{ background: s.soft, color: s.color }}
    >
      <span className="h-[5px] w-[5px] rounded-full" style={{ background: s.color }} aria-hidden="true" />
      <span className="ledger-label" style={{ fontSize: "0.625rem" }}>
        {label ?? kind}
      </span>
    </span>
  );
}

/* ---------------------------------------------------------------- */
/* Buttons — physical press, one accent voice.                       */
/* ----------------------------------------------------------------- */

type Variant = "primary" | "carbon" | "ghost";
type BaseProps = {
  variant?: Variant;
  children: ReactNode;
  arrow?: boolean;
  className?: string;
  style?: CSSProperties;
};
type ButtonProps = BaseProps & { ref?: Ref<HTMLButtonElement> };

const VARIANT: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-deep",
  carbon: "bg-ink text-paper hover:bg-ink-2",
  ghost: "border border-rule bg-transparent text-ink hover:bg-recess",
};

const BASE =
  "pressable inline-flex h-11 items-center justify-center gap-2.5 rounded-[4px] px-5 text-[0.9375rem] font-medium tracking-[-0.005em] whitespace-nowrap disabled:pointer-events-none disabled:opacity-40";

export function ButtonLink({
  variant = "primary",
  children,
  arrow,
  className,
  ...rest
}: BaseProps & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a className={`${BASE} ${VARIANT[variant]} ${className ?? ""}`} {...rest}>
      {children}
      {arrow && (
        <span className="grid h-5 w-5 place-items-center rounded-[3px] bg-white/20" aria-hidden="true">
          <PhArrowUpRight size={12} weight="bold" />
        </span>
      )}
    </a>
  );
}

export function Button({
  variant = "primary",
  children,
  arrow,
  className,
  style,
  ref,
  ...rest
}: ButtonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button ref={ref} style={style} className={`${BASE} ${VARIANT[variant]} ${className ?? ""}`} {...rest}>
      {children}
      {arrow && (
        <span className="grid h-5 w-5 place-items-center rounded-[3px] bg-white/20" aria-hidden="true">
          <PhArrowUpRight size={12} weight="bold" />
        </span>
      )}
    </button>
  );
}

/* ---------------------------------------------------------------- */
/* Layout rules — the ledger's ruling lines.                         */
/* ----------------------------------------------------------------- */

export function SectionRule({ label, right }: { label?: string; right?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between border-t border-rule-strong pt-3">
      {label && <span className="ledger-label text-ink-3">{label}</span>}
      {right}
    </div>
  );
}
