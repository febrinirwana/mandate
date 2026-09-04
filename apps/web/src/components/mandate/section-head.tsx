import type { ReactNode } from "react";

/**
 * Numbered chapter head for inspection sections: hairline, cobalt numeral,
 * display title, plain-language lede. The numbering is the reading order.
 */
export function SectionHead({
  num,
  title,
  lede,
  accent,
  right,
}: {
  num: string;
  title: string;
  lede?: string;
  accent?: "revoked";
  right?: ReactNode;
}) {
  return (
    <div className="border-t-2 pt-5" style={{ borderColor: accent ? "var(--revoked)" : "var(--ink)" }}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
        <div className="flex items-baseline gap-5">
          <span
            className="mono-data shrink-0 text-[0.9375rem] font-medium"
            style={accent ? { color: "var(--revoked)" } : { color: "var(--accent)" }}
          >
            {num}
          </span>
          <h2 className="display text-[clamp(1.75rem,3.2vw,2.75rem)]">{title}</h2>
        </div>
        {right}
      </div>
      {lede && <p className="lede mt-3 max-w-[64ch]">{lede}</p>}
    </div>
  );
}
