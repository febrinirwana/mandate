"use client";

import { useEffect, useRef } from "react";

/**
 * Halftone engine — samples vector scenes (or images) on a low-res grid and
 * re-renders them as dot-matrix fields, in the railgun-style halftone
 * language but generated procedurally so it stays crisp, theme-aware and
 * animatable.
 *
 * Scene contract: `draw(ctx, w, h)` receives a 100x100 normalized space.
 * Draw in BLACK for base dots and in RED for accent dots — the sampler
 * routes red-dominant pixels to the palette accent.
 */

export type DrawScene = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

export type HalftonePalette = {
  base: string;
  accent: string;
  /** alpha multiplier for base dots (default 0.26 — hero-wisp level) */
  baseAlpha?: number;
};

type Dot = {
  x: number;
  y: number;
  r: number;
  color: string;
  order: number;
};

type Props = {
  draw: DrawScene;
  palette: HalftonePalette;
  /** dot pitch in css px */
  cell?: number;
  className?: string;
  /** radial cascade entrance (skipped when reduced motion is on) */
  entry?: boolean;
  /** max px of pointer parallax, 0 disables */
  parallax?: number;
  /** when set, art is sampled from this image's alpha instead of the scene */
  imageSrc?: string;
};

const N = 100; // scene space

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const v = parseInt(h.length === 3 ? h.replace(/(.)/g, "$1$1") : h, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

export function Halftone({
  draw,
  palette,
  cell = 5,
  className,
  entry = true,
  parallax = 0,
  imageSrc,
}: Props) {
  const holderRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;
  const frameRef = useRef(0);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const holder = holderRef.current;
    const canvas = canvasRef.current;
    if (!holder || !canvas) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let disposed = false;
    let dots: Dot[] = [];

    const [br, bg2, bb] = hexToRgb(palette.base);
    const baseAlpha = palette.baseAlpha ?? 0.26;
    const [ar, ag, ab] = hexToRgb(palette.accent);

    const sample = (cssW: number, cssH: number) => {
      const cols = Math.max(8, Math.round(cssW / cell));
      const rows = Math.max(8, Math.round(cssH / cell));
      const off = document.createElement("canvas");
      off.width = cols;
      off.height = rows;
      const octx = off.getContext("2d", { willReadFrequently: true })!;
      if (imageSrc && imgRef.current) {
        const img = imgRef.current;
        const s = Math.max(cols / img.width, rows / img.height) * 0.86;
        const dw = img.width * s;
        const dh = img.height * s;
        octx.drawImage(img, (cols - dw) / 2, (rows - dh) / 2, dw, dh);
      } else {
        octx.scale(cols / N, rows / N);
        drawRef.current(octx, N, N);
      }
      const data = octx.getImageData(0, 0, cols, rows).data;

      const list: Dot[] = [];
      const originX = cssW * 0.36;
      const originY = cssH * 0.42;
      for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++) {
          const i = (gy * cols + gx) * 4;
          const a = data[i + 3] / 255;
          if (a < 0.05) continue;
          const r8 = data[i];
          const g8 = data[i + 1];
          // red-dominant pixel -> accent band; image mode: dense alpha -> accent
          const isAccent = imageSrc ? a > 0.55 : r8 > 120 && r8 > g8 * 1.6;
          const x = (gx + 0.5) * (cssW / cols);
          const y = (gy + 0.5) * (cssH / rows);
          const t = Math.sqrt(a); // area-correct radius
          const dx = x - originX;
          const dy = y - originY;
          list.push({
            x,
            y,
            r: cell * 0.64 * t,
            color: isAccent
              ? `rgba(${ar},${ag},${ab},${Math.min(1, a * 1.05).toFixed(3)})`
              : `rgba(${br},${bg2},${bb},${(a * baseAlpha).toFixed(3)})`,
            order: Math.sqrt(dx * dx + dy * dy),
          });
        }
      }
      list.sort((p, q) => p.order - q.order);
      for (let i = 0; i < list.length; i++) list[i].order = i / Math.max(1, list.length);
      return list;
    };

    const paint = (progress: number) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cssW = holder.clientWidth;
      const cssH = holder.clientHeight;
      const w = Math.round(cssW * dpr);
      const h = Math.round(cssH * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.scale(dpr, dpr);
      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];
        const p = progress >= 1 ? 1 : Math.max(0, Math.min(1, (progress - d.order * 0.82) / 0.18));
        if (p <= 0) continue;
        const e = 1 - Math.pow(1 - p, 3); // easeOutCubic per dot
        const r = d.r * (0.25 + 0.75 * e);
        ctx.globalAlpha = e;
        ctx.fillStyle = d.color;
        ctx.beginPath();
        ctx.arc(d.x, d.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };

    const render = (animate: boolean) => {
      if (disposed) return;
      const cssW = holder.clientWidth;
      const cssH = holder.clientHeight;
      if (cssW < 2 || cssH < 2) return;
      dots = sample(cssW, cssH);
      cancelAnimationFrame(frameRef.current);
      if (!animate || reduced) {
        paint(1);
        return;
      }
      const start = performance.now();
      const dur = 1250;
      const tick = (now: number) => {
        if (disposed) return;
        const t = Math.min(1, (now - start) / dur);
        paint(t);
        if (t < 1) frameRef.current = requestAnimationFrame(tick);
      };
      frameRef.current = requestAnimationFrame(tick);
    };

    const ro = new ResizeObserver(() => render(false));
    ro.observe(holder);
    if (imageSrc) {
      const img = new Image();
      img.onload = () => {
        if (disposed) return;
        imgRef.current = img;
        render(entry && !reduced);
      };
      img.src = imageSrc;
    } else {
      render(entry && !reduced);
    }

    // pointer parallax — transform only, rAF-lerped
    let px = 0;
    let py = 0;
    let tx = 0;
    let ty = 0;
    let raf = 0;
    const loop = () => {
      px += (tx - px) * 0.08;
      py += (ty - py) * 0.08;
      canvas.style.transform = `translate3d(${px.toFixed(2)}px, ${py.toFixed(2)}px, 0)`;
      if (Math.abs(tx - px) > 0.05 || Math.abs(ty - py) > 0.05) raf = requestAnimationFrame(loop);
      else raf = 0;
    };
    const onMove = (e: PointerEvent) => {
      if (reduced || !parallax || e.pointerType !== "mouse") return;
      const rect = holder.getBoundingClientRect();
      tx = ((e.clientX - rect.left) / rect.width - 0.5) * 2 * parallax;
      ty = ((e.clientY - rect.top) / rect.height - 0.5) * 2 * parallax;
      if (!raf) raf = requestAnimationFrame(loop);
    };
    if (parallax) holder.addEventListener("pointermove", onMove);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameRef.current);
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      holder.removeEventListener("pointermove", onMove);
    };
    // palette identity change re-renders for theme flips
  }, [cell, palette.base, palette.accent, entry, parallax, imageSrc]);

  return (
    <div ref={holderRef} className={className} aria-hidden="true">
      <canvas ref={canvasRef} className="h-full w-full" style={{ willChange: "transform" }} />
    </div>
  );
}
