// Auto-layout, container-aware. Every frame lays out its own contents the
// same way: the resources directly inside it flow left to right by role
// (ingress → handlers → messaging → workers → data), in columns only for
// the roles present, rows ordered so an edge tends to land next to its
// source; the child frames sit in a row beneath. A frame's size is what
// that needs plus its padding, and its parent packs it the same way, up
// to the canvas. Pure function: returns new positions and frame boxes,
// mutates nothing.

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
const FRAME_GAP = 40; // between sibling frames, and between resources and frames
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

/** Columns by rank, rows ordered by the mean row of each node's sources in
 *  the columns already placed (a one-pass barycentre), so edges run short
 *  and cross as little as possible.
 *
 *  Column widths and the gaps between them are measured, not fixed: a
 *  column is as wide as the widest thing drawn in it (the node, or its
 *  name underneath, which is often the wider of the two), and the gap
 *  between two columns is opened up by whatever edge labels have to sit in
 *  it. A gap of one constant put "upload events" on top of an arrowhead. */
function grid(nodes: ArchNode[], edges: ArchEdge[], opts: LayoutOpts): Block {
  const ids = new Set(nodes.map((n) => n.id));
  const within = edges.filter((e) => e.from !== e.to && ids.has(e.from) && ids.has(e.to));
  const rank = ranks(nodes, within);
  const depth = Math.max(-1, ...nodes.map((n) => rank.get(n.id)!));
  const columns = Array.from({ length: depth + 1 }, (_, r) => nodes.filter((n) => rank.get(n.id) === r)).filter((c) => c.length);
  const row = new Map<string, number>();
  columns.forEach((col, ci) => {
    const key = (n: ArchNode) => {
      const src = within.filter((e) => e.to === n.id && row.has(e.from)).map((e) => row.get(e.from)!);
      return src.length ? src.reduce((a, b) => a + b, 0) / src.length : Number.POSITIVE_INFINITY;
    };
    const ordered = col.map((n, i) => ({ n, i, k: key(n) })).sort((a, b) => a.k - b.k || a.i - b.i);
    ordered.forEach(({ n }, ri) => row.set(n.id, ri));
    columns[ci] = ordered.map((o) => o.n);
  });
  // What each column has to hold: the widest thing drawn in it · the node
  // as drawn, or its name, which in icon mode is usually the wider of the two.
  const drawW = opts.drawW ?? opts.nodeW;
  const drawH = opts.drawH ?? opts.nodeH;
  const colOf = new Map<string, number>();
  columns.forEach((col, ci) => col.forEach((n) => colOf.set(n.id, ci)));
  const widths = columns.map((col) => Math.max(drawW, ...col.map((n) => textWidth(n.name) + 16)));
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

  const out: Block = { w: 0, h: 0, nodes: {}, frames: {} };
  let x = 0;
  columns.forEach((col, ci) => {
    col.forEach((n, ri) => {
      out.nodes[n.id] = { x: x + widths[ci] / 2, y: ri * (drawH + ROW_GAP) + drawH / 2 };
    });
    x += widths[ci] + (gaps[ci] ?? 0);
  });
  // Spacing follows what is drawn; the block still has to hold every node's
  // hit-box, or a frame sized from this block would not contain what is in it
  // and two sibling frames could overlap. So the extent is measured over the
  // centres ± the hit-box, and the whole block is shifted back to the origin.
  const centres = Object.values(out.nodes);
  if (centres.length) {
    const minX = Math.min(...centres.map((p) => p.x)) - opts.nodeW / 2;
    const minY = Math.min(...centres.map((p) => p.y)) - opts.nodeH / 2;
    out.w = Math.max(...centres.map((p) => p.x)) + opts.nodeW / 2 - minX;
    out.h = Math.max(...centres.map((p) => p.y)) + opts.nodeH / 2 - minY;
    for (const p of centres) {
      p.x -= minX;
      p.y -= minY;
    }
  }
  return out;
}

/** Lay out one scope (a container, or the canvas when `id` is undefined):
 *  its own resources as a grid, its child frames in a row beneath. */
function scope(id: string | undefined, nodes: ArchNode[], edges: ArchEdge[], containers: Container[], opts: LayoutOpts, depth = 0): Block {
  const own = nodes.filter((n) => (n.container ?? undefined) === id);
  const block = grid(own, edges, opts);
  const kids = depth < 12 ? containers.filter((c) => (c.parent ?? undefined) === id) : [];
  let x = 0;
  const y = block.h ? block.h + FRAME_GAP : 0;
  let rowH = 0;
  for (const c of kids) {
    const inner = scope(c.id, nodes, edges, containers, opts, depth + 1);
    const pad = FRAME_PAD[c.kind] ?? 24;
    const w = Math.max(inner.w, 160) + pad * 2;
    const h = Math.max(inner.h, 60) + pad * 2 + FRAME_HEAD;
    block.frames[c.id] = { x, y, w, h };
    for (const [nid, p] of Object.entries(inner.nodes)) block.nodes[nid] = { x: x + pad + p.x, y: y + pad + FRAME_HEAD + p.y };
    for (const [cid, b] of Object.entries(inner.frames)) block.frames[cid] = { ...b, x: x + pad + b.x, y: y + pad + FRAME_HEAD + b.y };
    x += w + FRAME_GAP;
    rowH = Math.max(rowH, h);
  }
  if (kids.length) {
    block.w = Math.max(block.w, x - FRAME_GAP);
    block.h = y + rowH;
  }
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
