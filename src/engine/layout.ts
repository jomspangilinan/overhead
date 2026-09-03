// Auto-layout, container-aware.
//
// Every scope · the canvas, and the inside of every frame · is laid out the
// same way, and by the same rules a person uses: columns are dependency
// depth, so the drawing reads left to right along its arrows, and the rows
// inside a column are ordered so as few connections cross as possible.
//
// A child frame is **a box in that same flow**, not a shelf underneath it. A
// VPC whose Lambda is fed by an API Gateway takes the column after the API,
// exactly where you would draw it. Frames used to be parked in a row beneath
// their scope, which is what tangled the event-driven sample: the edge into
// the VPC had to leave the bottom of the region and cut back across two
// other edges to reach a frame at the left margin.
//
// A frame's size is what its contents need plus its padding, and its parent
// packs it like any other box, up to the canvas. Pure function: returns new
// positions and frame boxes, mutates nothing.

import type { ArchEdge, ArchNode, Role } from "./model";
import type { Container } from "./containers";
import { FRAME_PAD, FRAME_HEAD, type Bounds } from "./frames";
import { getService } from "./services";

export const ROLE_ORDER: Role[] = ["ingress", "handlers", "messaging", "workers", "data"];

export const ROLE_LABELS: Record<Role, string> = {
  ingress: "INGRESS",
  handlers: "HANDLERS",
  messaging: "MESSAGING",
  workers: "WORKERS",
  data: "DATA",
};

export const COL_GAP = 44; // clear space between columns, before labels widen it
export const ROW_GAP = 40; // clear space between rows
const X0 = 80;
const Y0 = 80;

export interface LayoutOpts {
  /** The room a node needs · its hit-box, which never changes. Frames are
   *  sized from this, so a frame always contains what it holds and siblings
   *  never overlap, whatever the spacing below turns out to be. */
  nodeW: number;
  nodeH: number;
  /** What a node *draws*, when that is smaller than its hit-box (icon mode).
   *  Columns and rows are spaced by this. Absent = the hit-box, which is
   *  card mode. */
  drawW?: number;
  drawH?: number;
}
const DEFAULT_OPTS: LayoutOpts = { nodeW: 200, nodeH: 100 };

export function roleOf(node: ArchNode): Role {
  return getService(node.service)?.role ?? "handlers";
}

/** Position for one new node: its role's column, first free row · nothing else moves. */
export function placeInRole(nodes: ArchNode[], lane: Role, opts: LayoutOpts = DEFAULT_OPTS): { x: number; y: number } {
  const inRole = nodes.filter((n) => roleOf(n) === lane);
  return {
    x: X0 + ROLE_ORDER.indexOf(lane) * (opts.nodeW + COL_GAP),
    y: inRole.length ? Math.max(...inRole.map((n) => n.position.y)) + opts.nodeH + ROW_GAP : Y0,
  };
}

export interface AutoLayoutResult {
  /** Node centres. */
  positions: Record<string, { x: number; y: number }>;
  /** Every container's frame, exactly fitting what it holds. */
  frames: Record<string, Bounds>;
  /** One per non-empty role among the resources outside every frame ·
   *  ordinary sections the user may rename or delete. */
  sections: { name: string; color: string; nodeIds: string[] }[];
}

const SECTION_COLORS = ["#3B82F6", "#E7157B", "#F0B34E", "#7AA116", "#8C4FFF"];

interface Block {
  w: number;
  h: number;
  /** Node centres relative to the block's top-left. */
  nodes: Record<string, { x: number; y: number }>;
  /** Frames relative to the block's top-left. */
  frames: Record<string, Bounds>;
}

/** Rank every node by dependency depth: the longest path to it over the
 *  edges inside this scope, with the back edges of any cycle ignored (a
 *  thumbnail worker writing back to the bucket it reads must not pull the
 *  bucket forward). Roles are not consulted · a chain reads left to right
 *  whatever services it happens to use. */
function ranks(nodes: ArchNode[], edges: ArchEdge[]): Map<string, number> {
  const out = new Map<string, string[]>(nodes.map((n) => [n.id, []]));
  for (const e of edges) out.get(e.from)!.push(e.to);
  // DFS colouring · an edge into a grey node closes a cycle, so drop it
  const colour = new Map<string, 0 | 1 | 2>();
  const kept = new Map<string, string[]>(nodes.map((n) => [n.id, []]));
  const visit = (id: string) => {
    colour.set(id, 1);
    for (const to of out.get(id) ?? []) {
      if (colour.get(to) === 1) continue;
      kept.get(id)!.push(to);
      if (!colour.get(to)) visit(to);
    }
    colour.set(id, 2);
  };
  for (const n of nodes) if (!colour.get(n.id)) visit(n.id);
  // longest path over the acyclic remainder (Kahn, relaxing as we go)
  const indeg = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  for (const [, tos] of kept) for (const to of tos) indeg.set(to, indeg.get(to)! + 1);
  const rank = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  const queue = nodes.filter((n) => indeg.get(n.id) === 0).map((n) => n.id);
  while (queue.length) {
    const u = queue.shift()!;
    for (const v of kept.get(u) ?? []) {
      rank.set(v, Math.max(rank.get(v)!, rank.get(u)! + 1));
      indeg.set(v, indeg.get(v)! - 1);
      if (indeg.get(v) === 0) queue.push(v);
    }
  }
  return rank;
}

/** Roughly how wide a string draws. The canvas label is 11px Archivo and
 *  an edge label 10px; there is no DOM here (the layout is pure TS so it
 *  can be unit-tested), and half a character of error costs nothing at
 *  this scale. */
const CHAR_W = 6.2;
const EDGE_CHAR_W = 5.4;
export function textWidth(text: string, charW = CHAR_W): number {
  return Math.ceil(text.trim().length * charW);
}

// ── Crossing reduction ─────────────────────────────────────────────────────
//
// Columns come from dependency depth; what is left to decide is the order of
// the rows inside each column, and that order is what decides how many edges
// cross. Two things the old one-pass barycentre could not do:
//
//   It only looked backwards. Ordering column 3 by its sources in column 2 is
//   half the problem · what column 3 feeds in column 4 matters just as much,
//   and a single forward pass can never account for it. So the order is swept
//   down and back up, repeatedly, keeping the best arrangement seen.
//
//   It ignored edges that skip a column. An edge from column 0 to column 3
//   crosses everything in 1 and 2 and had no say in how they were ordered.
//   The fix is the standard one: give that edge a placeholder vertex in each
//   column it passes through, so it takes part in the ordering like any other
//   and the columns open a lane for it. Placeholders are dropped before rows
//   are assigned · they decide order, they never take space.
//
// Median rather than mean (Eades & Wormald): the mean is dragged around by
// one distant neighbour, which is exactly the case that matters here, where
// a fan-out has one member far down the column.

const SWEEPS = 8;

interface Seg {
  /** Keys in the two adjacent layers · a real node id or a placeholder. */
  a: string;
  b: string;
}

/** Crossings between one pair of adjacent layers, from the current order. */
function crossingsBetween(segs: Seg[], posA: Map<string, number>, posB: Map<string, number>): number {
  let n = 0;
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const dx = posA.get(segs[i].a)! - posA.get(segs[j].a)!;
      const dy = posB.get(segs[i].b)! - posB.get(segs[j].b)!;
      if (dx * dy < 0) n++;
    }
  }
  return n;
}

/** The median of a node's neighbours' positions · its current index when it
 *  has none, which pins a disconnected node where it already sits. */
function medianKey(neighbours: number[], current: number): number {
  if (!neighbours.length) return current;
  const s = [...neighbours].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Order the rows of every column so as few edges cross as possible.
 *  `layers` is mutated into the best order found; the count is returned. */
function reduceCrossings(layers: string[][], segsBetween: Seg[][]): number {
  const posOf = (layer: string[]) => new Map(layer.map((k, i) => [k, i]));
  const total = (ls: string[][]) => {
    const pos = ls.map(posOf);
    return segsBetween.reduce((sum, segs, i) => sum + crossingsBetween(segs, pos[i], pos[i + 1]), 0);
  };

  let best = layers.map((l) => [...l]);
  let bestCount = total(best);
  const work = layers.map((l) => [...l]);

  for (let sweep = 0; sweep < SWEEPS && bestCount > 0; sweep++) {
    const down = sweep % 2 === 0;
    const order = down
      ? work.map((_, i) => i).slice(1)
      : work.map((_, i) => i).slice(0, -1).reverse();
    for (const i of order) {
      const fixed = posOf(work[down ? i - 1 : i + 1]);
      const segs = segsBetween[down ? i - 1 : i];
      const here = posOf(work[i]);
      const keys = new Map<string, number>();
      for (const k of work[i]) {
        const near = segs
          .filter((s) => (down ? s.b === k : s.a === k))
          .map((s) => fixed.get(down ? s.a : s.b)!)
          .filter((p) => p !== undefined);
        keys.set(k, medianKey(near, here.get(k)!));
      }
      // Stable on the current order, so a tie never churns the drawing.
      work[i] = [...work[i]].sort((x, y) => keys.get(x)! - keys.get(y)! || here.get(x)! - here.get(y)!);
    }
    const count = total(work);
    if (count < bestCount) {
      bestCount = count;
      best = work.map((l) => [...l]);
    }
  }
  layers.forEach((_, i) => (layers[i] = best[i]));
  return bestCount;
}

/** One thing to place: a resource, or a child frame with its contents
 *  already laid out inside it. A frame is a box like any other · that is the
 *  whole point of doing it this way. */
interface Box {
  id: string;
  /** What it draws, and what the column has to be wide enough for. */
  w: number;
  h: number;
  /** The room it needs, which for a resource is its constant hit-box. */
  hitW: number;
  hitH: number;
  frame?: boolean;
}

/** Where each box ends up · centres for resources, top-left for frames. */
interface Placed {
  centres: Record<string, { x: number; y: number }>;
  w: number;
  h: number;
}

/** Columns by rank, rows ordered so as few connections cross as possible
 *  (placeholder vertices for column-skipping edges, then median sweeps in
 *  both directions · see above), so edges run short and cross as little as
 *  possible.
 *
 *  Column widths and the gaps between them are measured, not fixed: a
 *  column is as wide as the widest thing drawn in it (a resource, its name
 *  underneath, which is often the wider of the two, or a whole frame), and
 *  the gap between two columns is opened up by whatever edge labels have to
 *  sit in it. A gap of one constant put "upload events" on top of an
 *  arrowhead. */
function place(boxes: Box[], links: { from: string; to: string; id: string; label?: string }[]): Placed {
  const ids = new Set(boxes.map((b) => b.id));
  const within = links.filter((e) => e.from !== e.to && ids.has(e.from) && ids.has(e.to));
  const rank = ranks(
    boxes.map((b) => ({ id: b.id }) as ArchNode),
    within as ArchEdge[],
  );
  const depth = Math.max(-1, ...boxes.map((b) => rank.get(b.id)!));
  const columns = Array.from({ length: depth + 1 }, (_, r) => boxes.filter((b) => rank.get(b.id) === r)).filter(
    (c) => c.length,
  );
  // The row order, decided on a layered graph: one layer per column, a
  // placeholder in every column an edge skips over, and the sweeps above.
  const rankOf = new Map<string, number>();
  columns.forEach((col, ci) => col.forEach((b) => rankOf.set(b.id, ci)));
  const layers: string[][] = columns.map((col) => col.map((b) => b.id));
  const segsBetween: Seg[][] = columns.slice(1).map(() => []);
  for (const e of within) {
    let a = rankOf.get(e.from)!;
    let b = rankOf.get(e.to)!;
    let from = e.from;
    let to = e.to;
    if (a === b) continue; // same column · nothing to cross between layers
    if (a > b) {
      // A back edge crosses the same lines forwards or backwards.
      [a, b] = [b, a];
      [from, to] = [to, from];
    }
    let prev = from;
    for (let c = a + 1; c < b; c++) {
      const dummy = `·${e.id}@${c}`;
      layers[c].push(dummy);
      segsBetween[c - 1].push({ a: prev, b: dummy });
      prev = dummy;
    }
    segsBetween[b - 1].push({ a: prev, b: to });
  }
  reduceCrossings(layers, segsBetween);
  // Placeholders decided the order; they never take a row.
  const byId = new Map(boxes.map((b) => [b.id, b]));
  columns.forEach((_, ci) => {
    columns[ci] = layers[ci].map((k) => byId.get(k)).filter((b): b is Box => !!b);
  });

  const colOf = new Map<string, number>();
  columns.forEach((col, ci) => col.forEach((b) => colOf.set(b.id, ci)));
  const widths = columns.map((col) => Math.max(...col.map((b) => b.w)));
  // What each gap has to hold: the widest label on an edge crossing it.
  const gaps = columns.slice(1).map((_, i) => {
    const crossing = within.filter((e) => {
      const a = colOf.get(e.from)!;
      const b = colOf.get(e.to)!;
      return Math.min(a, b) <= i && Math.max(a, b) >= i + 1 && e.label;
    });
    const widest = Math.max(0, ...crossing.map((e) => textWidth(e.label!, EDGE_CHAR_W) + 28));
    return Math.max(COL_GAP, widest);
  });

  // Columns stack their own boxes · a frame is taller than an icon, so rows
  // line up across columns only while the boxes are the same height, which
  // is the ordinary case and the one the tests pin.
  const centres: Record<string, { x: number; y: number }> = {};
  let x = 0;
  let w = 0;
  let h = 0;
  columns.forEach((col, ci) => {
    let y = 0;
    for (const b of col) {
      centres[b.id] = { x: x + widths[ci] / 2, y: y + b.h / 2 };
      w = Math.max(w, x + widths[ci] / 2 + b.hitW / 2);
      h = Math.max(h, y + b.h / 2 + b.hitH / 2);
      y += b.h + ROW_GAP;
    }
    x += widths[ci] + (gaps[ci] ?? 0);
  });
  // Spacing follows what is drawn; the block still has to hold every box's
  // room, or a frame sized from this block would not contain what is in it
  // and two siblings could overlap. So the extent is measured over the
  // centres ± the room, and the whole block is shifted back to the origin.
  const all = Object.entries(centres);
  if (all.length) {
    const minX = Math.min(...all.map(([id, p]) => p.x - byId.get(id)!.hitW / 2));
    const minY = Math.min(...all.map(([id, p]) => p.y - byId.get(id)!.hitH / 2));
    for (const [, p] of all) {
      p.x -= minX;
      p.y -= minY;
    }
    w -= minX;
    h -= minY;
  }
  return { centres, w, h };
}

/** Lay out one scope: the canvas, or one container's inside.
 *
 *  Its own resources **and its child frames go through the same placement**,
 *  as boxes in one layered graph. Frames used to be parked in a row beneath
 *  everything, which is what made event-driven look tangled: `ingest-api`
 *  fed a Lambda inside the VPC, so its line had to leave the bottom of the
 *  region and cut back across `domain-bus → order-flow` and
 *  `domain-bus → fan-out` to reach a frame parked at the left margin. Ranked
 *  as a box, the VPC simply takes the column after the thing that feeds it,
 *  and the line goes straight there · which is also how anybody draws this
 *  by hand.
 *
 *  An edge to anything inside a frame (at any depth) counts as an edge to
 *  the frame, so a resource three levels down still pulls its frame into
 *  the right column. */
function scope(id: string | undefined, nodes: ArchNode[], edges: ArchEdge[], containers: Container[], opts: LayoutOpts, depth = 0): Block {
  const own = nodes.filter((n) => (n.container ?? undefined) === id);
  const kids = depth < 12 ? containers.filter((c) => (c.parent ?? undefined) === id) : [];
  const drawW = opts.drawW ?? opts.nodeW;
  const drawH = opts.drawH ?? opts.nodeH;

  const block: Block = { w: 0, h: 0, nodes: {}, frames: {} };
  const boxes: Box[] = own.map((n) => ({
    id: n.id,
    // A name is often wider than the icon above it.
    w: Math.max(drawW, textWidth(n.name) + 16),
    h: drawH,
    hitW: opts.nodeW,
    hitH: opts.nodeH,
  }));

  /** Every resource inside a child frame, mapped to that frame · this is
   *  what turns an edge into a Lambda in a subnet into an edge to the VPC. */
  const standsFor = new Map<string, string>();
  const inner = new Map<string, { block: Block; pad: number }>();
  for (const c of kids) {
    const laid = scope(c.id, nodes, edges, containers, opts, depth + 1);
    const pad = FRAME_PAD[c.kind] ?? 24;
    inner.set(c.id, { block: laid, pad });
    const w = Math.max(laid.w, 160) + pad * 2;
    const h = Math.max(laid.h, 60) + pad * 2 + FRAME_HEAD;
    boxes.push({ id: c.id, w, h, hitW: w, hitH: h, frame: true });
    for (const nid of Object.keys(laid.nodes)) standsFor.set(nid, c.id);
  }

  // Links between boxes: an edge's ends resolved to the box that draws them.
  const boxOf = (nid: string) => (own.some((n) => n.id === nid) ? nid : standsFor.get(nid));
  const links = edges.flatMap((e) => {
    const from = boxOf(e.from);
    const to = boxOf(e.to);
    return from && to && from !== to ? [{ id: e.id, from, to, label: e.label }] : [];
  });

  const { centres, w, h } = place(boxes, links);
  for (const b of boxes) {
    const p = centres[b.id];
    if (!p) continue;
    if (!b.frame) {
      block.nodes[b.id] = p;
      continue;
    }
    const held = inner.get(b.id)!;
    const x = p.x - b.w / 2;
    const y = p.y - b.h / 2;
    block.frames[b.id] = { x, y, w: b.w, h: b.h };
    for (const [nid, q] of Object.entries(held.block.nodes))
      block.nodes[nid] = { x: x + held.pad + q.x, y: y + held.pad + FRAME_HEAD + q.y };
    for (const [cid, r] of Object.entries(held.block.frames))
      block.frames[cid] = { ...r, x: x + held.pad + r.x, y: y + held.pad + FRAME_HEAD + r.y };
  }
  block.w = w;
  block.h = h;
  return block;
}

export function autoLayout(
  nodes: ArchNode[],
  edges: ArchEdge[] = [],
  containers: Container[] = [],
  opts: LayoutOpts = DEFAULT_OPTS,
): { positions: Record<string, { x: number; y: number }>; frames: Record<string, Bounds> } {
  const root = scope(undefined, nodes, edges, containers, opts);
  const positions: Record<string, { x: number; y: number }> = {};
  for (const [id, p] of Object.entries(root.nodes)) positions[id] = { x: X0 + p.x, y: Y0 + p.y };
  const frames: Record<string, Bounds> = {};
  for (const [id, b] of Object.entries(root.frames)) frames[id] = { ...b, x: X0 + b.x, y: Y0 + b.y };
  return { positions, frames };
}

/**
 * Arrange everything and describe the top-level arrangement as sections ·
 * one per column of resources that sit outside every frame, named after the
 * role most of them play. A column holding a single resource gets no
 * section: a dashed box around one icon says nothing, and a four-node chain
 * used to come back wearing four of them. The names are a suggestion the
 * user can rename or throw away · never structure.
 */
export function autoLayoutWithSections(
  nodes: ArchNode[],
  edges: ArchEdge[] = [],
  containers: Container[] = [],
  opts: LayoutOpts = DEFAULT_OPTS,
): AutoLayoutResult {
  const { positions, frames } = autoLayout(nodes, edges, containers, opts);
  const byColumn = new Map<number, ArchNode[]>();
  for (const n of nodes) {
    if (n.container && containers.some((c) => c.id === n.container)) continue;
    // An auto section is a *role* grouping ("Ingress", "Data"), and a role is
    // an AWS idea · a flow shape has none, so a decision and a start marker
    // in the same column are not "Data" and must not be boxed as if they
    // were. They keep every other part of the layout.
    if ((getService(n.service)?.family ?? "aws") !== "aws") continue;
    const x = positions[n.id]?.x ?? 0;
    byColumn.set(x, [...(byColumn.get(x) ?? []), n]);
  }
  const used = new Map<string, number>();
  const sections = [...byColumn.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, group]) => group)
    .filter((group) => group.length > 1)
    .map((group, i) => {
      const counts = new Map<Role, number>();
      for (const n of group) counts.set(roleOf(n), (counts.get(roleOf(n)) ?? 0) + 1);
      const top = ROLE_ORDER.filter((r) => counts.has(r)).sort((a, b) => counts.get(b)! - counts.get(a)!)[0] ?? "handlers";
      const base = ROLE_LABELS[top][0] + ROLE_LABELS[top].slice(1).toLowerCase();
      const seen = (used.get(base) ?? 0) + 1;
      used.set(base, seen);
      return {
        name: seen > 1 ? `${base} ${seen}` : base,
        color: SECTION_COLORS[i % SECTION_COLORS.length],
        nodeIds: group.map((n) => n.id),
      };
    });
  return { positions, frames, sections };
}
