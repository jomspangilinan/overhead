// What a request touches, and the order it touches it in.
//
// Two answers from one walk, because the canvas needs both and they must not
// disagree: the **set** of resources reached (what lights up, what the pill
// counts and prices) and the **branches** — every distinct route from the
// origin to a leaf, as an ordered list of connections.
//
// The set was computed by a BFS written twice, once in `Canvas.tsx` for the
// T tool and once in `tools.ts` for `trace_request`. The branches are new:
// they are what lets a pulse travel the path one route at a time instead of
// every traced edge blinking at once, which reads as "these are highlighted"
// rather than "this is what happens".

import type { ArchEdge } from "./model";

export interface Trace {
  /** Every resource reached, the origin first. */
  nodeIds: string[];
  /** Every route origin → leaf, each an ordered list of edge ids. Longest
   *  first, so the pulse opens on the route that says the most. */
  branches: string[][];
}

/** Stop a pathological fan-out from producing thousands of routes · the
 *  pulse can only show so many, and a drawing this branchy is better read
 *  by hovering. */
const MAX_BRANCHES = 24;
const MAX_DEPTH = 40;

export function traceFrom(edges: ArchEdge[], originId: string): Trace {
  const out = new Map<string, ArchEdge[]>();
  for (const e of edges) {
    if (e.from === e.to) continue;
    out.set(e.from, [...(out.get(e.from) ?? []), e]);
  }

  // The set · breadth-first, so the order reads outward from the origin.
  const nodeIds: string[] = [originId];
  const seen = new Set([originId]);
  const queue = [originId];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const e of out.get(cur) ?? []) {
      if (seen.has(e.to)) continue;
      seen.add(e.to);
      nodeIds.push(e.to);
      queue.push(e.to);
    }
  }

  // The branches · depth-first, one entry per route that runs out of edges.
  // `onPath` rather than a global visited set: a diamond (two routes that
  // rejoin) is two routes, which is what a request actually does, and it is
  // also what stops a cycle from running forever.
  const branches: string[][] = [];
  const walk = (node: string, path: string[], onPath: Set<string>) => {
    if (branches.length >= MAX_BRANCHES || path.length >= MAX_DEPTH) return;
    const next = (out.get(node) ?? []).filter((e) => !onPath.has(e.to));
    if (!next.length) {
      if (path.length) branches.push(path);
      return;
    }
    for (const e of next) {
      walk(e.to, [...path, e.id], new Set([...onPath, e.to]));
    }
  };
  walk(originId, [], new Set([originId]));
  branches.sort((a, b) => b.length - a.length);

  return { nodeIds, branches };
}
