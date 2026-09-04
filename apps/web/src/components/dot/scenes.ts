/**
 * Vector scenes for the halftone engine, drawn in a 100x100 normalized space.
 * BLACK fills become base dots; RED (#f00) fills route to the accent band.
 */

type Ctx = CanvasRenderingContext2D;
const BLACK = "#000000";
const RED = "#f00000";

function flowLine(ctx: Ctx, pts: [number, number][], width: number, color: string, alpha = 1) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const [cx, cy] = pts[i];
    const [x, y] = pts[i + 1];
    ctx.quadraticCurveTo(cx, cy, (cx + x) / 2, (cy + y) / 2);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last[0], last[1]);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function blob(ctx: Ctx, pts: [number, number][], color: string, alpha = 1) {
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const [cx, cy] = pts[i];
    const [x, y] = pts[i + 1];
    ctx.quadraticCurveTo(cx, cy, (cx + x) / 2, (cy + y) / 2);
  }
  ctx.lineTo(pts[pts.length - 1][0], 100);
  ctx.lineTo(pts[0][0], 100);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** A notarial rosette — Mandate's seal-sun. */
export function seal(ctx: Ctx, cx: number, cy: number, R: number, color = RED) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  const bumps = 14;
  for (let i = 0; i < bumps; i++) {
    const a = (i / bumps) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * R * 0.94, Math.sin(a) * R * 0.94, R * 0.15, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.lineWidth = R * 0.09;
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.74, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? R * 0.15 : R * 0.42;
    const x = Math.cos(a) * rr;
    const y = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = R * 0.05;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * R * 1.04, Math.sin(a) * R * 1.04);
    ctx.lineTo(Math.cos(a) * R * 1.2, Math.sin(a) * R * 1.2);
    ctx.stroke();
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Hero: the seal-sun rises over the settlement horizon, a signature   */
/* stroke crossing the frame low, out of the reading zone.             */
/* ------------------------------------------------------------------ */

export function sceneSealSun(ctx: Ctx, _w: number, _h: number) {
  // distant hill
  blob(
    ctx,
    [
      [0, 62],
      [22, 56],
      [46, 52],
      [70, 58],
      [100, 62],
    ],
    BLACK,
    0.14,
  );
  // near hill
  blob(
    ctx,
    [
      [0, 88],
      [18, 80],
      [40, 76],
      [62, 82],
      [84, 86],
      [100, 84],
    ],
    BLACK,
    0.28,
  );
  // ledger document lines, bottom-left — the paper the order is written on
  for (let i = 0; i < 4; i++) {
    flowLine(ctx, [[4, 92 + i * 2.4], [20 - i * 2, 92 + i * 2.4]], 0.55, BLACK, 0.2);
  }
  // signature stroke crossing the frame
  flowLine(
    ctx,
    [
      [0, 82],
      [16, 76],
      [34, 81],
      [52, 70],
      [74, 74],
      [100, 68],
    ],
    1.7,
    RED,
    0.9,
  );
  flowLine(
    ctx,
    [
      [0, 83.6],
      [16, 77.6],
      [34, 82.6],
      [52, 71.6],
      [74, 75.6],
      [100, 69.6],
    ],
    0.8,
    RED,
    0.55,
  );
  // the seal-sun
  seal(ctx, 66, 30, 13);
}

/* ------------------------------------------------------------------ */
/* Chapter 01 — Identity: a live nameplate with a verification tick.   */
/* ------------------------------------------------------------------ */

export function sceneIdentity(ctx: Ctx, _w: number, _h: number) {
  // nameplate
  ctx.fillStyle = BLACK;
  ctx.globalAlpha = 0.85;
  roundRect(ctx, 24, 28, 50, 34, 5);
  ctx.fill();
  ctx.globalAlpha = 1;
  // engraved lines (cut out)
  cut(ctx, () => {
    ctx.fillRect(31, 37, 22, 3);
    ctx.fillRect(31, 44, 30, 2);
    ctx.fillRect(31, 50, 17, 2);
  });
  // verification tick, overlapping the corner
  ctx.fillStyle = RED;
  ctx.beginPath();
  ctx.arc(70, 60, 10, 0, Math.PI * 2);
  ctx.fill();
  cut(ctx, () => {
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = "#000";
    ctx.beginPath();
    ctx.moveTo(65.5, 60);
    ctx.lineTo(68.8, 63.4);
    ctx.lineTo(74.8, 56.6);
    ctx.stroke();
  });
}

/* ------------------------------------------------------------------ */
/* Chapter 02 — Mandate: the immutable order document, sealed.         */
/* ------------------------------------------------------------------ */

export function sceneMandate(ctx: Ctx, _w: number, _h: number) {
  ctx.fillStyle = BLACK;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.moveTo(30, 16);
  ctx.lineTo(56, 16);
  ctx.lineTo(70, 30);
  ctx.lineTo(70, 78);
  ctx.lineTo(30, 78);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  // fold
  ctx.fillStyle = BLACK;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.moveTo(56, 16);
  ctx.lineTo(70, 30);
  ctx.lineTo(56, 30);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  // ruled lines (cut out)
  cut(ctx, () => {
    for (let i = 0; i < 6; i++) ctx.fillRect(36, 26 + i * 6, 28 - (i % 3) * 7, 2);
  });
  // wax seal over the fold
  seal(ctx, 58, 62, 11);
}

/* ------------------------------------------------------------------ */
/* Chapter 03 — Settlement: the pull/swap/push loop, custody intact.   */
/* ------------------------------------------------------------------ */

export function sceneSettlement(ctx: Ctx, _w: number, _h: number) {
  const cx = 50;
  const cy = 48;
  const R = 20;
  ctx.strokeStyle = BLACK;
  ctx.lineWidth = 3.4;
  ctx.globalAlpha = 0.85;
  // three arcs with gaps at 0°, 120°, 240°
  for (const start of [20, 140, 260]) {
    ctx.beginPath();
    ctx.arc(cx, cy, R, (start * Math.PI) / 180, ((start + 92) * Math.PI) / 180);
    ctx.stroke();
    // arrowhead at arc end
    const ae = ((start + 92) * Math.PI) / 180;
    const hx = cx + Math.cos(ae) * R;
    const hy = cy + Math.sin(ae) * R;
    const tang = ae + Math.PI / 2;
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(tang);
    ctx.fillStyle = BLACK;
    ctx.beginPath();
    ctx.moveTo(4.5, 0);
    ctx.lineTo(-3, 3.6);
    ctx.lineTo(-3, -3.6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  // the coin at the center — value, never custody
  ctx.fillStyle = RED;
  ctx.beginPath();
  ctx.arc(cx, cy, 9.5, 0, Math.PI * 2);
  ctx.fill();
  cut(ctx, () => {
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = "#000";
    ctx.beginPath();
    ctx.arc(cx, cy, 5.6, 0, Math.PI * 2);
    ctx.stroke();
  });
}

/* ------------------------------------------------------------------ */
/* Invariants panel: an elegant countersignature with seal.            */
/* ------------------------------------------------------------------ */

export function sceneSignature(ctx: Ctx, _w: number, _h: number) {
  // the countersigned page: ruled order lines, a bold approval stroke,
  // and the rosette seal pressed over it
  for (let i = 0; i < 6; i++) {
    flowLine(ctx, [[8, 30 + i * 7], [92 - (i % 3) * 14, 30 + i * 7]], 0.6, BLACK, 0.28);
  }
  flowLine(ctx, [[8, 78], [64, 78]], 2.2, BLACK, 0.8);
  flowLine(ctx, [[8, 79.9], [64, 79.9]], 0.9, BLACK, 0.4);
  seal(ctx, 74, 66, 16);
}

/* helpers ---------------------------------------------------------- */

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function cut(ctx: Ctx, fn: () => void) {
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = "#000";
  ctx.strokeStyle = "#000";
  fn();
  ctx.restore();
}
