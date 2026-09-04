"use client";

import { Check as PhCheck, Copy as PhCopy } from "@phosphor-icons/react/dist/ssr";
import { useState } from "react";

export function CopyValue({ value, display, className }: { value: string; display?: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable — the full value remains in title/aria */
    }
  };

  return (
    <button
      type="button"
      onClick={() => void copy()}
      title={value}
      aria-label={`Copy full value ${value}`}
      className={`mono-data group inline-flex max-w-full items-center gap-1.5 text-ink-2 hover:text-ink ${className ?? ""}`}
    >
      <span className="truncate">{display ?? value}</span>
      <span className="grid h-4 w-4 shrink-0 place-items-center text-ink-3 transition-colors group-hover:text-accent">
        {copied ? <PhCheck size={12} weight="bold" className="text-confirmed" /> : <PhCopy size={12} />}
      </span>
    </button>
  );
}
