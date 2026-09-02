// Floating-edge geometry, pure and React-free. Anchors are computed from
// node positions + the known visual shape (icon rim or card edge) — never
// from React Flow handle coordinates.
//
// Each node has four sides. `pickSides` chooses the pair by geometry: the
// axis with the larger clear gap wins, so a target below its source is
// entered from the top instead of looping round to its left. Explicit
// `anchors` on the edge override a side; `bracket` (same side out and back
// in) is the fallback when the two shapes overlap.
//
// A path runs through `points = [p0, ...waypoints, p3]` as a curve (cubic
// segments, end tangents along the side normals so arrowheads enter square),
// a straight polyline, or axis-aligned steps. `mids` are the per-segment
// midpoints the canvas uses as "+" handles for new waypoints.

import type { EdgeShape, Side } from "@/engine/model";
import { NODE_H, ICON } from "./nodeMetrics";

/** Rim inset from centre in icon mode (icon half-width + breathing room). */
const RIM = ICON / 2 + 6;
/** Icon centre y in node-local coords: 7 margin + 4 padding + 28 half-icon. */
const ICON_CY = (NODE_H - ICON - 22) / 2 - 4 + 4 + ICON / 2;
/** The 200×76 card sits centred in the 200×100 hit-box. */
const CARD_VISUAL_H = 76;

export type P = { x: number; y: number };
export type Side4 = Exclude<Side, "auto">;

export interface Shape {
  /** centre (flow coords) */
  cx: number;
  cy: number;
  /** half-extent to the left/right anchors and to the top/bottom anchors */
  hw: number;
  hh: number;
}

export function shapeOf(pos: P, w: number, h: number, card: boolean): Shape {
  if (card) {
    const hh = h === NODE_H ? CARD_VISUAL_H / 2 : h / 2;
    return { cx: pos.x + w / 2, cy: pos.y + h / 2, hw: w / 2, hh };
  }
  return { cx: pos.x + w / 2, cy: pos.y + ICON_CY, hw: RIM, hh: RIM };
}

/** Shape from a store centre (positions in the model are centres). */
export function shapeAt(centre: P, w: number, h: number, card: boolean): Shape {
  return shapeOf({ x: centre.x - w / 2, y: centre.y - h / 2 }, w, h, card);
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function bezierPoint(t: number, p0: P, p1: P, p2: P, p3: P): P {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}

export const NORMAL: Record<Side4, P> = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  top: { x: 0, y: -1 },
  bottom: { x: 0, y: 1 },
};
const isHorizontal = (s: Side4) => s === "left" || s === "right";

/** The anchor point on a side; `offset` runs along the side (fan slots). */
export function anchorPoint(s: Shape, side: Side4, offset = 0): P {
  switch (side) {
    case "left":
      return { x: s.cx - s.hw, y: s.cy + offset };
    case "right":
      return { x: s.cx + s.hw, y: s.cy + offset };
    case "top":
      return { x: s.cx + offset, y: s.cy - s.hh };
    case "bottom":
      return { x: s.cx + offset, y: s.cy + s.hh };
  }
}

export type CaseKind = "forward" | "back" | "down" | "up" | "bracket" | "return" | "pinned";

/** A back edge on the same row is a *return path* once it is long enough to
 *  have something in the middle: a worker writing back to the bucket it read
 *  from sits two columns to the right of it, and an S-curve out the left and
 *  in the right runs the line, and its label, straight through the queue in
 *  between. Past this span the pair is left and entered from underneath, so
 *  the path swings below the row it belongs to. */
const RETURN_SPAN = 150;

/** Pick exit and entry sides. The axis with the larger clear gap wins (a
 *  slight bias keeps left-to-right flows horizontal); with no clearance on
 *  either axis the edge brackets out one side and back in. */
export function pickSides(
  s: Shape,
  t: Shape,
  opts: { from?: Side; to?: Side; outwardK?: 1 | -1 } = {},
): { from: Side4; to: Side4; caseKind: CaseKind } {
  const dx = t.cx - s.cx;
  const dy = t.cy - s.cy;
  const fwdGap = t.cx - t.hw - (s.cx + s.hw);
  const backGap = s.cx - s.hw - (t.cx + t.hw);
  const downGap = t.cy - t.hh - (s.cy + s.hh);
  const upGap = s.cy - s.hh - (t.cy + t.hh);
  const hGap = Math.max(fwdGap, backGap);
  const vGap = Math.max(downGap, upGap);
  const tol = 24;

  let from: Side4, to: Side4, caseKind: CaseKind;
  const sameRow = Math.abs(dy) < s.hh + t.hh;
  if (hGap >= tol && hGap * 1.15 >= vGap) {
    if (dx >= 0) [from, to, caseKind] = ["right", "left", "forward"];
    else if (sameRow && backGap >= RETURN_SPAN) [from, to, caseKind] = ["bottom", "bottom", "return"];
    else [from, to, caseKind] = ["left", "right", "back"];
  } else if (vGap >= tol) {
    if (dy >= 0) [from, to, caseKind] = ["bottom", "top", "down"];
    else [from, to, caseKind] = ["top", "bottom", "up"];
  } else {
    const k = opts.outwardK ?? 1;
    from = to = k === 1 ? "right" : "left";
    caseKind = "bracket";
  }
  // The "back" case is an S-curve out the left and in the right. That is
  // the wanted shape only when there is real vertical offset; level pairs
  // read better with the same treatment (monotonic in x), so keep it.
  const f = opts.from && opts.from !== "auto" ? opts.from : from;
  const t2 = opts.to && opts.to !== "auto" ? opts.to : to;
  if (f !== from || t2 !== to) caseKind = "pinned";
  return { from: f, to: t2, caseKind };
}

/** Cubic control reach for one end, from how far the other end is along
 *  that end's own normal axis. */
function reachFor(a: P, b: P, side: Side4, caseKind: CaseKind): number {
  const along = isHorizontal(side) ? Math.abs(b.x - a.x) : Math.abs(b.y - a.y);
  const across = isHorizontal(side) ? Math.abs(b.y - a.y) : Math.abs(b.x - a.x);
  if (caseKind === "back") return clamp(0.45 * Math.hypot(b.x - a.x, b.y - a.y), 40, 150);
  // Both ends leave downwards · the reach is how deep the U hangs, and it
  // has to clear the row before it can travel back across it.
  if (caseKind === "return") return clamp(0.3 * Math.abs(b.x - a.x), 56, 140);
  if (caseKind === "bracket") return clamp(across * 0.45, 60, 90);
  return Math.max(24, 0.5 * along);
}

/** Segments as cubics through `pts`, tangents at the ends along the side
 *  normals, interior tangents Catmull-Rom style. */
function cubicSegments(
  pts: P[],
  fromSide: Side4,
  toSide: Side4,
  caseKind: CaseKind,
): { c1: P; c2: P; a: P; b: P }[] {
  const n = pts.length;
  const out: { c1: P; c2: P; a: P; b: P }[] = [];
  if (n < 2) return out;
  const n0 = NORMAL[fromSide];
  const n3 = NORMAL[toSide];
  if (n === 2) {
    const [a, b] = pts;
    const r0 = reachFor(a, b, fromSide, caseKind);
    const r3 = reachFor(b, a, toSide, caseKind);
    return [{ a, b, c1: { x: a.x + n0.x * r0, y: a.y + n0.y * r0 }, c2: { x: b.x + n3.x * r3, y: b.y + n3.y * r3 } }];
  }
  // tangent (direction × magnitude) at every point
  const tangents: P[] = pts.map((p, i) => {
    if (i === 0) {
      const r = clamp(0.5 * Math.hypot(pts[1].x - p.x, pts[1].y - p.y), 24, 120);
      return { x: n0.x * r, y: n0.y * r };
    }
    if (i === n - 1) {
      const r = clamp(0.5 * Math.hypot(p.x - pts[n - 2].x, p.y - pts[n - 2].y), 24, 120);
      return { x: -n3.x * r, y: -n3.y * r };
    }
    return { x: (pts[i + 1].x - pts[i - 1].x) / 2, y: (pts[i + 1].y - pts[i - 1].y) / 2 };
  });
  for (let i = 0; i < n - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    out.push({
      a,
      b,
      c1: { x: a.x + tangents[i].x / 3, y: a.y + tangents[i].y / 3 },
      c2: { x: b.x - tangents[i + 1].x / 3, y: b.y - tangents[i + 1].y / 3 },
    });
  }
  return out;
}

export function curvePath(pts: P[], fromSide: Side4, toSide: Side4, caseKind: CaseKind = "forward"): { d: string; mids: P[] } {
  const segs = cubicSegments(pts, fromSide, toSide, caseKind);
  if (!segs.length) return { d: "", mids: [] };
  let d = `M${pts[0].x},${pts[0].y}`;
  const mids: P[] = [];
  for (const s of segs) {
    d += ` C${s.c1.x},${s.c1.y} ${s.c2.x},${s.c2.y} ${s.b.x},${s.b.y}`;
    mids.push(bezierPoint(0.5, s.a, s.c1, s.c2, s.b));
  }
  return { d, mids };
}

export function straightPath(pts: P[]): { d: string; mids: P[] } {
  if (pts.length < 2) return { d: "", mids: [] };
  let d = `M${pts[0].x},${pts[0].y}`;
  const mids: P[] = [];
  for (let i = 1; i < pts.length; i++) {
    d += ` L${pts[i].x},${pts[i].y}`;
    mids.push({ x: (pts[i - 1].x + pts[i].x) / 2, y: (pts[i - 1].y + pts[i].y) / 2 });
  }
  return { d, mids };
}

/** Axis-aligned legs. The first leg leaves along the exit side, the last
 *  arrives along the entry side; a segment whose ends want the same axis
 *  takes a Z through the midline. */
export function stepPath(pts: P[], fromSide: Side4, toSide: Side4): { d: string; mids: P[]; corners: P[][] } {
  if (pts.length < 2) return { d: "", mids: [], corners: [] };
  const last = pts.length - 2;
  let d = `M${pts[0].x},${pts[0].y}`;
  const mids: P[] = [];
  const corners: P[][] = [];
  for (let i = 0; i <= last; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const startAxis = i === 0 ? (isHorizontal(fromSide) ? "h" : "v") : null;
    const endAxis = i === last ? (isHorizontal(toSide) ? "h" : "v") : null;
    let via: P[];
    if (startAxis && endAxis && startAxis === endAxis) {
      via =
        startAxis === "h"
          ? [{ x: (a.x + b.x) / 2, y: a.y }, { x: (a.x + b.x) / 2, y: b.y }]
          : [{ x: a.x, y: (a.y + b.y) / 2 }, { x: b.x, y: (a.y + b.y) / 2 }];
    } else if (startAxis === "h" || endAxis === "v") {
      via = [{ x: b.x, y: a.y }];
    } else {
      via = [{ x: a.x, y: b.y }];
    }
    const leg = [a, ...via.filter((p) => !(p.x === a.x && p.y === a.y) && !(p.x === b.x && p.y === b.y)), b];
    for (let j = 1; j < leg.length; j++) d += ` L${leg[j].x},${leg[j].y}`;
    corners.push(leg.slice(1, -1));
    // midpoint at half the leg's length
    let total = 0;
    for (let j = 1; j < leg.length; j++) total += Math.hypot(leg[j].x - leg[j - 1].x, leg[j].y - leg[j - 1].y);
    let run = 0;
    let mid: P = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    for (let j = 1; j < leg.length; j++) {
      const len = Math.hypot(leg[j].x - leg[j - 1].x, leg[j].y - leg[j - 1].y);
      if (run + len >= total / 2) {
        const k = len ? (total / 2 - run) / len : 0;
        mid = { x: leg[j - 1].x + (leg[j].x - leg[j - 1].x) * k, y: leg[j - 1].y + (leg[j].y - leg[j - 1].y) * k };
        break;
      }
      run += len;
    }
    mids.push(mid);
  }
  return { d, mids, corners };
}

/** A self-loop: out the right side, back in the top, reaching further for
 *  each extra loop on the same node. */
export function loopPath(s: Shape, slot = 0): EdgeGeo {
  const p0 = { x: s.cx + s.hw, y: s.cy - s.hh * 0.35 };
  const p3 = { x: s.cx + s.hw * 0.35, y: s.cy - s.hh };
  const reach = 44 + slot * 14;
  const c1 = { x: p0.x + reach, y: p0.y };
  const c2 = { x: p3.x, y: p3.y - reach };
  const mid = bezierPoint(0.5, p0, c1, c2, p3);
  return {
    d: `M${p0.x},${p0.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${p3.x},${p3.y}`,
    label: { x: mid.x + 6, y: mid.y - 10 },
    caseKind: "bracket",
    p0,
    p3,
    fromSide: "right",
    toSide: "top",
    points: [p0, p3],
    mids: [mid],
  };
}

export interface EdgeGeo {
  d: string;
  label: P;
  caseKind: CaseKind;
  /** Start and end anchors. */
  p0: P;
  p3: P;
  fromSide: Side4;
  toSide: Side4;
  /** p0, waypoints…, p3 — the draggable points. */
  points: P[];
  /** One per segment: where a new waypoint can be added. */
  mids: P[];
}

export interface BuildOpts {
  waypoints?: P[];
  shape?: EdgeShape;
  from?: Side;
  to?: Side;
  /** Pre-picked sides (the canvas picks them so fans group per side). */
  sides?: { from: Side4; to: Side4; caseKind: CaseKind };
  outwardK?: 1 | -1;
  /** Nudge along the side so edges meeting the same node don't stack. */
  sourceOffset?: number;
  targetOffset?: number;
}

export function buildEdge(source: Shape, target: Shape, opts: BuildOpts = {}): EdgeGeo {
  const sides = opts.sides ?? pickSides(source, target, { from: opts.from, to: opts.to, outwardK: opts.outwardK });
  const p0 = anchorPoint(source, sides.from, opts.sourceOffset ?? 0);
  let p3 = anchorPoint(target, sides.to, opts.targetOffset ?? 0);
  // Coincident anchors: give the marker a tangent.
  if (Math.abs(p3.x - p0.x) < 1 && Math.abs(p3.y - p0.y) < 1) p3 = { ...p3, y: p3.y + 0.01 };
  const points = [p0, ...(opts.waypoints ?? []), p3];
  const shape = opts.shape ?? "curve";
  const built =
    shape === "straight"
      ? straightPath(points)
      : shape === "step"
        ? stepPath(points, sides.from, sides.to)
        : curvePath(points, sides.from, sides.to, sides.caseKind);
  const mid = built.mids[Math.floor((built.mids.length - 1) / 2)] ?? p0;
  const label = sides.caseKind === "bracket" && points.length === 2 ? mid : { x: mid.x, y: mid.y - 10 };
  return { d: built.d, label, caseKind: sides.caseKind, p0, p3, fromSide: sides.from, toSide: sides.to, points, mids: built.mids };
}

/** Back-compatible wrapper: the floating default with no waypoints. */
export function edgeGeometry(
  source: Shape,
  target: Shape,
  opts: { outwardK?: 1 | -1; sourceOffset?: number; targetOffset?: number; from?: Side; to?: Side } = {},
): EdgeGeo {
  return buildEdge(source, target, opts);
}
