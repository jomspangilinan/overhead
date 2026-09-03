// Deleting a selection.
//
// A selection is a mixed bag · resources, containers, sections, and possibly
// an edge · and deleting it has to be one operation, both so it is one undo
// step and so the repairs are consistent: an edge whose end is gone goes
// with it, a section keeps only the members it still has, and a frame that
// goes does not take what was inside it (nothing inside it was selected, so
// its contents re-parent upward, exactly as removing one frame does).
//
// Pure, because the store is not testable and this is the part with rules.

import type { StateSnapshot } from "./model";

export interface Removal {
  /** Ids of nodes, containers and sections to remove · anything else is ignored. */
  ids: Iterable<string>;
  /** An edge selected on its own. */
  edgeId?: string | null;
}

export function removeObjects(snap: StateSnapshot, { ids, edgeId }: Removal): StateSnapshot {
  const wanted = new Set(ids);
  const goneNodes = new Set(snap.nodes.filter((n) => wanted.has(n.id)).map((n) => n.id));
  const goneFrames = new Set(snap.containers.filter((c) => wanted.has(c.id)).map((c) => c.id));
  const parentOf = new Map(snap.containers.map((c) => [c.id, c.parent]));

  /** Where a survivor lands: the nearest ancestor still standing. */
  const survivingParent = (id: string | undefined): string | undefined => {
    const seen = new Set<string>();
    let up = id;
    while (up && goneFrames.has(up) && !seen.has(up)) {
      seen.add(up);
      up = parentOf.get(up);
    }
    return up && goneFrames.has(up) ? undefined : up;
  };

  return {
    ...snap,
    nodes: snap.nodes
      .filter((n) => !goneNodes.has(n.id))
      .map((n) => (n.container && goneFrames.has(n.container) ? { ...n, container: survivingParent(n.container) } : n)),
    edges: snap.edges.filter((e) => !goneNodes.has(e.from) && !goneNodes.has(e.to) && e.id !== edgeId),
    containers: snap.containers
      .filter((c) => !goneFrames.has(c.id))
      .map((c) => (c.parent && goneFrames.has(c.parent) ? { ...c, parent: survivingParent(c.parent) } : c)),
    sections: snap.sections
      .filter((x) => !wanted.has(x.id))
      .map((x) => ({
        ...x,
        nodeIds: x.nodeIds.filter((id) => !goneNodes.has(id)),
        ...(x.parentId && wanted.has(x.parentId) ? { parentId: undefined } : {}),
      })),
  };
}
