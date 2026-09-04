"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Counts up to `target` with easeOutExpo once `active` turns true.
 * `format` receives the eased value each frame; returns display text.
 * Reduced motion and SSR render the final value directly.
 */
export function useCountUp(target: number, active: boolean, format: (v: number) => string, duration = 1200) {
  const [text, setText] = useState(() => format(target));
  const rafRef = useRef(0);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!active || reduced) {
      setText(format(target));
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const e = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      setText(format(target * e));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    setText(format(0));
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // format identity is caller-stable
  }, [active, target, duration, format]);

  return text;
}
