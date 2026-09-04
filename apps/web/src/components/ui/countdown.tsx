"use client";

import { useEffect, useState } from "react";

function parts(targetMs: number) {
  const diff = Math.max(0, targetMs - Date.now());
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  return { d, h, m, s, expired: diff === 0 };
}

/**
 * Expiry countdown in dd:hh:mm:ss, tabular digits so ticks never shift.
 * Mount-gated: the server cannot know the client's clock, so the first
 * paint shows a stable placeholder and the live value replaces it.
 */
export function Countdown({ until, className }: { until: string; className?: string }) {
  const targetMs = Date.parse(until);
  const [t, setT] = useState<{ d: number; h: number; m: number; s: number; expired: boolean } | null>(null);

  useEffect(() => {
    setT(parts(targetMs));
    const id = setInterval(() => setT(parts(targetMs)), 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  const pad = (n: number) => String(n).padStart(2, "0");
  const text = t ? (t.expired ? "00:00:00:00" : `${pad(t.d)}:${pad(t.h)}:${pad(t.m)}:${pad(t.s)}`) : "——:——:——:——";
  const absolute = `${until.replace("T", " ").replace(":00Z", " UTC")}`;

  return (
    <time dateTime={until} title={`Expiry ${absolute}`} className={className}>
      {text}
    </time>
  );
}
