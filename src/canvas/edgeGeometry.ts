// Floating-edge geometry, pure and React-free. Anchors are computed from
// node positions + the known visual shape (icon rim or card edge) — never
// from React Flow handle coordinates. Three cases per OVERHEAD-PLAN.md §5
// rule 5 and reference/diagram-module.js edgePath():
//   forward  — right-mid → left-mid, controls at 50% Δx
//   back     — S-curve leaving source LEFT, entering target RIGHT
//   bracket  — same column: out one side and back in

import { NODE_H, ICON } from "./nodeMetrics";

/** Rim inset from centre in icon mode (icon half-width + breathing room). */
const RIM = ICON / 2 + 6;
/** Icon centre y in node-local coords: 7 margin + 4 padding + 28 half-icon. */
const ICON_CY = (NODE_H - ICON - 22) / 2 - 4 + 4 + ICON / 2;

export interface Shape {
  /** centre x (flow coords) */
  cx: number;
  /** half-width to the anchor point */
  hw: number;
  /** anchor y (flow coords) */
  ay: number;
}

export function shapeOf(
  pos: { x: number; y: number },
  w: number,
  h: number,
  card: boolean,
): Shape {
  return card
    ? { cx: pos.x + w / 2, hw: w / 2, ay: pos.y + h / 2 }
    : { cx: pos.x + w / 2, hw: RIM, ay: pos.y + ICON_CY };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

type P = { x: number; y: number };

function bezierPoint(t: number, p0: P, p1: P, p2: P, p3: P): P {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}

export interface EdgeGeo {
  d: string;
  label: { x: number; y: number };
  caseKind: "forward" | "back" | "bracket";
}

export function edgeGeometry(
  source: Shape,
  target: Shape,
  opts: {
    outwardK?: 1 | -1;
    /** Vertical nudge so edges meeting the same node don't stack. */
    sourceOffset?: number;
    targetOffset?: number;
  } = {},
): EdgeGeo {
  // Offsets shift the anchors before the case is picked, so a fanned edge
  // still routes sensibly. Zero by default — a lone edge is unchanged.
  const s: Shape = { ...source, ay: source.ay + (opts.sourceOffset ?? 0) };
  const t: Shape = { ...target, ay: target.ay + (opts.targetOffset ?? 0) };
  const dy = t.ay - s.ay;
  const fwdGap = t.cx - t.hw - (s.cx + s.hw);
  const backGap = s.cx - s.hw - (t.cx + t.hw);
  // Tolerance grows with vertical offset so near-vertical pairs bracket
  // instead of drawing a stubby hook.
  const tol = Math.max(24, Math.min(96, Math.abs(dy) * 0.3));

  let p0: P, p1: P, p2: P, p3: P;
  let caseKind: EdgeGeo["caseKind"];

  if (fwdGap >= tol) {
    caseKind = "forward";
    p0 = { x: s.cx + s.hw, y: s.ay };
    p3 = { x: t.cx - t.hw, y: t.ay };
    const dx = Math.max(24, p3.x - p0.x);
    p1 = { x: p0.x + dx * 0.5, y: p0.y };
    p2 = { x: p3.x - dx * 0.5, y: p3.y };
  } else if (backGap >= tol) {
    caseKind = "back";
    p0 = { x: s.cx - s.hw, y: s.ay };
    p3 = { x: t.cx + t.hw, y: t.ay };
    // 0.45·hypot keeps x monotonic on horizontal hops (no wiggle) and
    // bulges into an S once there's vertical offset.
    const reach = clamp(0.45 * Math.hypot(p3.x - p0.x, dy), 40, 150);
    p1 = { x: p0.x - reach, y: p0.y };
    p2 = { x: p3.x + reach, y: p3.y };
  } else {
    caseKind = "bracket";
    const k = opts.outwardK ?? 1;
    p0 = { x: s.cx + k * s.hw, y: s.ay };
    p3 = { x: t.cx + k * t.hw, y: t.ay };
    const reach = clamp(Math.abs(dy) * 0.45, 60, 90);
    p1 = { x: p0.x + k * reach, y: p0.y };
    p2 = { x: p3.x + k * reach, y: p3.y };
  }

  // Coincident nodes: give the marker a tangent.
  if (Math.abs(p3.x - p0.x) < 1 && Math.abs(dy) < 1) p3 = { ...p3, y: p3.y + 0.01 };

  const mid = bezierPoint(0.5, p0, p1, p2, p3);
  const label =
    caseKind === "bracket" ? mid : { x: mid.x, y: mid.y - 10 };

  return {
    d: `M${p0.x},${p0.y} C${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`,
    label,
    caseKind,
  };
}
