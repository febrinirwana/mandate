"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

/**
 * Tonal halftone landscape — the railgun grammar: figurative layered ridges
 * and pine clusters rendered as variable-radius dots in one periwinkle hue
 * family. Not a binary sampler: each cell's dot radius scales with the
 * silhouette coverage, so the field reads as tonal print, not a grid.
 *
 * Layers pre-render once to offscreen bitmaps; runtime frames only composite
 * bitmaps with per-layer pointer parallax. On entry each layer rises in a
 * bottom-up band reveal (skipped under prefers-reduced-motion).
 */

type LayerSpec = {
  color: string;
  /** pointer parallax depth in px */
  depth: number;
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number, rng: () => number) => void;
};

function ridge(yBase: number, amp: number, freq: number, phase: number) {
  return (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x++) {
      const t = (x / w) * Math.PI * 2;
      const y =
        yBase * h +
        Math.sin(t * freq + phase) * amp * h +
        Math.sin(t * freq * 2.7 + phase * 2.1) * amp * 0.38 * h;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  };
}

function pines(baseY: number, spread: number, minH: number, maxH: number) {
  return (ctx: CanvasRenderingContext2D, w: number, h: number, rng: () => number) => {
    let x = -w * 0.04;
    while (x < w * 1.04) {
      const cluster = 2 + Math.floor(rng() * 4);
      const clusterW = w * (0.04 + rng() * 0.05);
      for (let i = 0; i < cluster; i++) {
        const px = x + (clusterW * (i + rng() * 0.7)) / cluster;
        const ph = h * (minH + rng() * (maxH - minH));
        const base = h * (baseY + rng() * spread);
        const pw = ph * (0.4 + rng() * 0.14);
        ctx.beginPath();
        ctx.moveTo(px, base - ph);
        ctx.lineTo(px + pw / 2, base);
        ctx.lineTo(px - pw / 2, base);
        ctx.closePath();
        ctx.fill();
      }
      x += clusterW + w * (0.03 + rng() * 0.06);
    }
  };
}

const LAYERS: LayerSpec[] = [
  { color: "#c9c7f0", depth: 3, draw: ridge(0.5, 0.05, 2.1, 0.4) },
  { color: "#b2b0e7", depth: 6, draw: ridge(0.63, 0.06, 1.6, 2.1) },
  { color: "#918ed9", depth: 10, draw: pines(0.8, 0.12, 0.045, 0.11) },
  { color: "#7d7ad6", depth: 15, draw: ridge(0.93, 0.02, 2.9, 4.3) },
];

type LayerBmp = { canvas: HTMLCanvasElement; depth: number };

export function Landscape({ className, cell = 6 }: { className?: string; cell?: number }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const host = hostRef.current as HTMLDivElement;
    if (!hostRef.current) return;

    let raf = 0;
    let disposed = false;
    let layers: LayerBmp[] = [];
    let W = 0;
    let H = 0;
    let bmpH = 0;
    let inView = true;
    let px = 0;
    let py = 0;
    let tx = 0;
    let ty = 0;
    let entranceStart = 0;
    const ENTRANCE_MS = 1400;
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    function mulberry(seed: number) {
      let s = seed >>> 0;
      return () => {
        s |= 0;
        s = (s + 0x6d2b79f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    function easeOutExpo(t: number) {
      return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
    }

    function build() {
      const rect = host.getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4) return;
      W = Math.ceil(rect.width * dpr);
      H = Math.ceil(rect.height * dpr);
      const cellPx = cell * dpr;
      const cols = Math.ceil(W / cellPx);
      const rows = Math.ceil(H / cellPx);
      bmpH = rows * cellPx;

      layers = LAYERS.map((spec, li) => {
        // 1px-per-cell silhouette pass
        const sil = document.createElement("canvas");
        sil.width = cols;
        sil.height = rows;
        const sctx = sil.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D;
        sctx.fillStyle = "#000";
        spec.draw(sctx, cols, rows, mulberry(li * 97 + 13));
        const img = sctx.getImageData(0, 0, cols, rows).data;

        // variable-radius dot pass into a full-res bitmap
        const bmp = document.createElement("canvas");
        bmp.width = cols * cellPx;
        bmp.height = bmpH;
        const bctx = bmp.getContext("2d") as CanvasRenderingContext2D;
        bctx.fillStyle = spec.color;
        const rMax = cellPx * 0.4;
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            const a = img[(y * cols + x) * 4 + 3] / 255;
            if (a <= 0.02) continue;
            const r = rMax * Math.sqrt(a);
            bctx.beginPath();
            bctx.arc((x + 0.5) * cellPx, (y + 0.5) * cellPx, r, 0, Math.PI * 2);
            bctx.fill();
          }
        }
        return { canvas: bmp, depth: spec.depth };
      });

      entranceStart = 0;
    }

    function frame(ts: number) {
      if (disposed) return;
      raf = requestAnimationFrame(frame);
      if (!inView || layers.length === 0 || W === 0) return;

      px += (tx - px) * 0.06;
      py += (ty - py) * 0.06;

      let progress = 1;
      if (!entranceStart) entranceStart = ts;
      progress = reduced ? 1 : Math.min(1, (ts - entranceStart) / ENTRANCE_MS);
      const done = progress >= 1;

      const canvas = host.querySelector("canvas") as HTMLCanvasElement;
      const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
      ctx.clearRect(0, 0, W, H);

      layers.forEach(({ canvas, depth }, li) => {
        const ox = px * depth * dpr;
        const oy = py * depth * 0.4 * dpr;
        if (done) {
          ctx.drawImage(canvas, ox, oy);
        } else {
          // bottom-up band reveal, per-layer stagger
          const p = Math.max(0, Math.min(1, progress * 1.45 - li * 0.15));
          const revealH = Math.max(1, easeOutExpo(p) * bmpH);
          ctx.drawImage(
            canvas,
            0,
            bmpH - revealH,
            canvas.width,
            revealH,
            ox,
            oy + bmpH - revealH,
            canvas.width,
            revealH,
          );
        }
      });
    }

    function ensureCanvas() {
      let canvas = host.querySelector("canvas") as HTMLCanvasElement | null;
      if (!canvas) {
        canvas = document.createElement("canvas");
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        canvas.style.display = "block";
        host.appendChild(canvas);
      }
      const rect = host.getBoundingClientRect();
      canvas.width = Math.ceil(rect.width * dpr);
      canvas.height = Math.ceil(rect.height * dpr);
    }

    ensureCanvas();
    build();

    const ro = new ResizeObserver(() => {
      ensureCanvas();
      build();
    });
    ro.observe(host);

    const io = new IntersectionObserver(([e]) => (inView = e.isIntersecting), { rootMargin: "80px" });
    io.observe(host);

    const onMove = (e: PointerEvent) => {
      if (reduced) return;
      const r = host.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width) * 2 - 1;
      ty = ((e.clientY - r.top) / r.height) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    raf = requestAnimationFrame(frame);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
    };
  }, [cell, reduced]);

  return <div ref={hostRef} className={className} aria-hidden="true" />;
}
