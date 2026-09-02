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

const COL_GAP = 80; // clear space between columns
const ROW_GAP = 50; // clear space between rows
const FRAME_GAP = 40; // between sibling frames, and between resources and frames
const X0 = 80;
const Y0 = 80;

export interface LayoutOpts {
  nodeW: number;
  nodeH: number;
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

/** Columns by role, rows ordered by the mean row of each node's sources in
 *  the previous column (a one-pass barycentre), so edges run short. */
function grid(nodes: ArchNode[], edges: ArchEdge[], opts: LayoutOpts): Block {
  const columns = ROLE_ORDER.map((r) => nodes.filter((n) => roleOf(n) === r)).filter((c) => c.length);
  const row = new Map<string, number>();
  columns.forEach((col, ci) => {
    const prev = ci ? columns[ci - 1] : [];
    const key = (n: ArchNode) => {
      const src = edges.filter((e) => e.to === n.id && prev.some((p) => p.id === e.from)).map((e) => row.get(e.from) ?? 0);
      return src.length ? src.reduce((a, b) => a + b, 0) / src.length : Number.POSITIVE_INFINITY;
    };
    const ordered = col.map((n, i) => ({ n, i, k: key(n) })).sort((a, b) => a.k - b.k || a.i - b.i);
    ordered.forEach(({ n }, ri) => row.set(n.id, ri));
    columns[ci] = ordered.map((o) => o.n);
  });
  const out: Block = { w: 0, h: 0, nodes: {}, frames: {} };
  columns.forEach((col, ci) => {
    col.forEach((n, ri) => {
      out.nodes[n.id] = { x: ci * (opts.nodeW + COL_GAP) + opts.nodeW / 2, y: ri * (opts.nodeH + ROW_GAP) + opts.nodeH / 2 };
    });
  });
  if (columns.length) {
    const rows = Math.max(...columns.map((c) => c.length));
    out.w = columns.length * opts.nodeW + (columns.length - 1) * COL_GAP;
    out.h = rows * opts.nodeH + (rows - 1) * ROW_GAP;
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
 * Arrange everything and describe the top-level arrangement as sections.
 * The roles are a suggestion the user can throw away · never structure.
 */
export function autoLayoutWithSections(
  nodes: ArchNode[],
  edges: ArchEdge[] = [],
  containers: Container[] = [],
  opts: LayoutOpts = DEFAULT_OPTS,
): AutoLayoutResult {
  const { positions, frames } = autoLayout(nodes, edges, containers, opts);
  const byRole = new Map<Role, string[]>();
  for (const n of nodes) {
    if (n.container && containers.some((c) => c.id === n.container)) continue;
    const role = roleOf(n);
    byRole.set(role, [...(byRole.get(role) ?? []), n.id]);
  }
  const sections = ROLE_ORDER.filter((r) => byRole.get(r)?.length).map((r, i) => ({
    name: ROLE_LABELS[r][0] + ROLE_LABELS[r].slice(1).toLowerCase(),
    color: SECTION_COLORS[i % SECTION_COLORS.length],
    nodeIds: byRole.get(r)!,
  }));
  return { positions, frames, sections };
}
