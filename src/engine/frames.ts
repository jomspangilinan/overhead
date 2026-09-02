// Container frame geometry, pure and React-free. A frame's box is the union
// of what it contains (member nodes, child frames, plus per-kind padding)
// and whatever bounds the user stored by dragging or resizing it. So the
// stored bounds are a floor and a position, never a clip: a member dragged
// past the edge grows the frame, removing members shrinks it back to the
// stored rectangle and no further.

import type { ArchNode, Section, StateSnapshot } from "./model";
import { descendantIds, type Container, type ContainerKind } from "./containers";

export interface Box {
  l: number;
  t: number;
  r: number;
  b: number;
}

export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Padding per kind so nested frames don't touch. */
export const FRAME_PAD: Record<ContainerKind, number> = {
  cloud: 46,
  region: 34,
  vpc: 28,
  subnetpub: 22,
  subnetpri: 22,
};

/** Room above the content for the icon + label + name band. */
export const FRAME_HEAD = 14;

/** A container created with nothing inside gets a starting rectangle so it
 *  is visible and draggable at once. Larger kinds are larger. */
export const DEFAULT_SIZE: Record<ContainerKind, { w: number; h: number }> = {
  cloud: { w: 560, h: 340 },
  region: { w: 460, h: 280 },
  vpc: { w: 380, h: 230 },
  subnetpub: { w: 280, h: 160 },
  subnetpri: { w: 280, h: 160 },
};

const union = (a: Box, b: Box): Box => ({
  l: Math.min(a.l, b.l),
  t: Math.min(a.t, b.t),
  r: Math.max(a.r, b.r),
  b: Math.max(a.b, b.b),
});

export const toBox = (b: Bounds): Box => ({ l: b.x, t: b.y, r: b.x + b.w, b: b.y + b.h });
export const toBounds = (b: Box): Bounds => ({ x: b.l, y: b.t, w: b.r - b.l, h: b.b - b.t });

export interface FrameOpts {
  nodeW: number;
  nodeH: number;
  /** A node being dragged is left out, so its old frame doesn't chase it
   *  and a hit-test on drop sees the frames as they were. */
  exclude?: string | null;
}

/**
 * Content box of one container: its own nodes and its child frames, padded.
 * `null` when there is nothing inside. Recursive through `boxes` so a child
 * is computed once.
 */
function contentBox(
  c: Container,
  nodes: ArchNode[],
  containers: Container[],
  opts: FrameOpts,
  compute: (c: Container) => Box | null,
): Box | null {
  let acc: Box | null = null;
  for (const n of nodes) {
    if (n.container !== c.id || n.id === opts.exclude) continue;
    const nb = {
      l: n.position.x - opts.nodeW / 2,
      t: n.position.y - opts.nodeH / 2,
      r: n.position.x + opts.nodeW / 2,
      b: n.position.y + opts.nodeH / 2,
    };
    acc = acc ? union(acc, nb) : nb;
  }
  for (const child of containers) {
    if (child.parent !== c.id || child.id === c.id) continue;
    const cb = compute(child);
    if (cb) acc = acc ? union(acc, cb) : cb;
  }
  if (!acc) return null;
  const pad = FRAME_PAD[c.kind] ?? 24;
  return { l: acc.l - pad, t: acc.t - pad - FRAME_HEAD, r: acc.r + pad, b: acc.b + pad };
}

/** The content-only boxes (no stored bounds) — the floor a resize may not go under. */
export function contentBoxes(
  nodes: ArchNode[],
  containers: Container[],
  opts: FrameOpts,
): Map<string, Box | null> {
  const out = new Map<string, Box | null>();
  const compute = (c: Container): Box | null => {
    if (out.has(c.id)) return out.get(c.id)!;
    out.set(c.id, null); // cycle guard
    const box = contentBox(c, nodes, containers, opts, compute);
    out.set(c.id, box);
    return box;
  };
  for (const c of containers) compute(c);
  return out;
}

/** The boxes as drawn: stored bounds ∪ content. Containers with neither are absent. */
export function frameBoxes(
  nodes: ArchNode[],
  containers: Container[],
  opts: FrameOpts,
): Map<string, Box> {
  const out = new Map<string, Box>();
  const compute = (c: Container): Box | null => {
    if (out.has(c.id)) return out.get(c.id)!;
    const content = contentBox(c, nodes, containers, opts, compute);
    const stored = c.bounds ? toBox(c.bounds) : null;
    const box = content && stored ? union(content, stored) : content ?? stored;
    if (box) out.set(c.id, box);
    return box;
  };
  for (const c of containers) compute(c);
  return out;
}

/** Nesting depth, 0 at the top level. */
export function depthOf(containers: Container[], c: Container): number {
  let d = 0;
  let p = c.parent;
  for (let i = 0; p && i < 12; i++) {
    d++;
    p = containers.find((x) => x.id === p)?.parent;
  }
  return d;
}

const inside = (b: Box, p: { x: number; y: number }) =>
  p.x >= b.l && p.x <= b.r && p.y >= b.t && p.y <= b.b;

/**
 * The deepest container whose frame contains the point — what a node
 * dropped there should join. `null` means the open canvas.
 */
export function hitContainer(
  boxes: Map<string, Box>,
  containers: Container[],
  point: { x: number; y: number },
  visible: (c: Container) => boolean = () => true,
): Container | null {
  let best: Container | null = null;
  let bestDepth = -1;
  for (const c of containers) {
    const box = boxes.get(c.id);
    if (!box || !visible(c) || !inside(box, point)) continue;
    const d = depthOf(containers, c);
    if (d > bestDepth) {
      best = c;
      bestDepth = d;
    }
  }
  return best;
}

/**
 * Translate a container by (dx, dy): its stored bounds, every descendant
 * frame's stored bounds, and every node inside at any depth. One patch so
 * undo captures it as a single step.
 */
export function translateContainer(
  snap: Pick<StateSnapshot, "nodes" | "containers"> & { sections?: Section[] },
  id: string,
  dx: number,
  dy: number,
): Pick<StateSnapshot, "nodes" | "containers" | "sections"> {
  return translateFrame({ ...snap, sections: snap.sections ?? [] }, { kind: "container", id }, dx, dy);
}

// ---- sections -------------------------------------------------------------

/** Room a section frame keeps around its members; the top also carries the
 *  same header band containers have, so both frames read the same way. */
export const SECTION_PAD = 26;
export const SECTION_HEAD = 22;

/** Section boxes as drawn: members ∪ stored bounds, same rule as containers
 *  (bounds are a floor and a position, never a clip). Groups draw nothing. */
export function sectionBoxes(nodes: ArchNode[], sections: Section[], opts: FrameOpts): Map<string, Box> {
  const out = new Map<string, Box>();
  for (const s of sections) {
    if (s.kind === "group") continue;
    const members = nodes.filter((n) => s.nodeIds.includes(n.id) && n.id !== opts.exclude);
    let box: Box | null = null;
    if (members.length) {
      box = {
        l: Math.min(...members.map((n) => n.position.x - opts.nodeW / 2)) - SECTION_PAD,
        t: Math.min(...members.map((n) => n.position.y - opts.nodeH / 2)) - SECTION_PAD - SECTION_HEAD,
        r: Math.max(...members.map((n) => n.position.x + opts.nodeW / 2)) + SECTION_PAD,
        b: Math.max(...members.map((n) => n.position.y + opts.nodeH / 2)) + SECTION_PAD,
      };
    }
    if (s.bounds) box = box ? union(box, toBox(s.bounds)) : toBox(s.bounds);
    if (box) out.set(s.id, box);
  }
  return out;
}

/** The members' box alone (no stored bounds): the floor a section resize may not go under. */
export function sectionContentBox(nodes: ArchNode[], s: Section, opts: FrameOpts): Box | null {
  return sectionBoxes(nodes, [{ ...s, bounds: undefined, kind: "section" }], opts).get(s.id) ?? null;
}

// ---- moving frames ----------------------------------------------------------

export type FrameRef = { kind: "container" | "section"; id: string };

/** Every node a frame carries when it moves: a container's subtree, a
 *  section's members through nested sections. */
export function movedNodeIds(snap: Pick<StateSnapshot, "nodes" | "containers" | "sections">, ref: FrameRef): Set<string> {
  if (ref.kind === "container") {
    const ids = new Set([ref.id, ...descendantIds(snap.containers, ref.id)]);
    return new Set(snap.nodes.filter((n) => n.container && ids.has(n.container)).map((n) => n.id));
  }
  const out = new Set<string>();
  const walk = (id: string, depth: number) => {
    const s = snap.sections.find((x) => x.id === id);
    if (!s || depth > 12) return;
    for (const m of s.nodeIds) out.add(m);
    for (const c of snap.sections.filter((x) => x.parentId === id)) walk(c.id, depth + 1);
  };
  walk(ref.id, 0);
  return out;
}

/** Every section whose stored bounds travel with the frame: the dragged
 *  section and its descendants, plus (for any frame) every section whose
 *  members all ride along, so a section drawn inside a container follows
 *  it. A section spanning in and out of the frame stays put and stretches. */
export function movedSectionIds(snap: Pick<StateSnapshot, "nodes" | "containers" | "sections">, ref: FrameRef, moved = movedNodeIds(snap, ref)): Set<string> {
  const out = new Set<string>();
  if (ref.kind === "section") {
    const walk = (id: string, depth: number) => {
      out.add(id);
      if (depth > 12) return;
      for (const c of snap.sections.filter((x) => x.parentId === id)) walk(c.id, depth + 1);
    };
    walk(ref.id, 0);
  }
  for (const s of snap.sections) {
    if (out.has(s.id)) continue;
    const members = s.nodeIds.filter((id) => snap.nodes.some((n) => n.id === id));
    if (members.length && members.every((id) => moved.has(id))) out.add(s.id);
  }
  return out;
}

/** Translate a frame by (dx, dy) in one patch: its stored bounds, every
 *  descendant frame's stored bounds, every node it carries, and the bounds
 *  of every section that rides along. */
export function translateFrame(
  snap: Pick<StateSnapshot, "nodes" | "containers" | "sections">,
  ref: FrameRef,
  dx: number,
  dy: number,
): Pick<StateSnapshot, "nodes" | "containers" | "sections"> {
  const nodes = movedNodeIds(snap, ref);
  const sections = movedSectionIds(snap, ref, nodes);
  const containers = ref.kind === "container" ? new Set([ref.id, ...descendantIds(snap.containers, ref.id)]) : new Set<string>();
  const shift = <T extends { bounds?: Bounds }>(x: T): T => (x.bounds ? { ...x, bounds: { ...x.bounds, x: x.bounds.x + dx, y: x.bounds.y + dy } } : x);
  return {
    containers: snap.containers.map((c) => (containers.has(c.id) ? shift(c) : c)),
    sections: snap.sections.map((s) => (sections.has(s.id) ? shift(s) : s)),
    nodes: snap.nodes.map((n) => (nodes.has(n.id) ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } } : n)),
  };
}

/** Clamp requested bounds so the frame never shrinks under its content. */
export function clampBounds(requested: Bounds, floor: Box | null, min = 120): Bounds {
  let { x, y, w, h } = requested;
  w = Math.max(min, w);
  h = Math.max(min * 0.6, h);
  if (floor) {
    x = Math.min(x, floor.l);
    y = Math.min(y, floor.t);
    w = Math.max(w, floor.r - x);
    h = Math.max(h, floor.b - y);
  }
  return { x, y, w, h };
}

/**
 * Where a new, empty container should land: inside its parent's frame when
 * there is one, otherwise clear of everything already drawn. Anchored at the
 * top-left so the frame grows down and right.
 */
export function placeNewFrame(
  kind: ContainerKind,
  parentBox: Box | null,
  occupied: Box[],
  siblingsInParent: Box[],
): Bounds {
  const size = DEFAULT_SIZE[kind];
  if (parentBox) {
    const pad = FRAME_PAD[kind] + 8;
    // stack below existing siblings inside the parent
    const below = siblingsInParent.reduce((m, b) => Math.max(m, b.b), parentBox.t + FRAME_HEAD + 30);
    return { x: parentBox.l + pad, y: below + 16, w: size.w, h: size.h };
  }
  if (!occupied.length) return { x: 80, y: 80, w: size.w, h: size.h };
  const right = Math.max(...occupied.map((b) => b.r));
  const top = Math.min(...occupied.map((b) => b.t));
  return { x: right + 60, y: top, w: size.w, h: size.h };
}
