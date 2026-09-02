// Anything loaded from outside the current build — autosave, import_state,
// a sample file — comes through here. Never lose the user's work: an illegal
// placement is re-parented up to the nearest legal ancestor, not dropped.

import type { StateSnapshot, Section, ArchEdge, EdgeStyle } from "./model";
import { DEFAULT_TRAFFIC } from "./model";
import {
  LEGAL_PARENTS,
  type Container,
  type ContainerKind,
  CONTAINER_KINDS,
} from "./containers";

/** v1 groups → v2 containers; `logical` becomes a section, `az` dissolves. */
const KIND_MAP: Record<string, ContainerKind | null> = {
  cloud: "cloud",
  region: "region",
  vpc: "vpc",
  subnet: "subnetpub",
  subnetpub: "subnetpub",
  subnetpri: "subnetpri",
  az: null, // dropped — members re-parent to the AZ's own parent
  logical: null, // becomes a Section
};

interface LegacyGroup {
  id: string;
  kind: string;
  name: string;
  cidr?: string;
  parent?: string;
  collapsed?: boolean;
}

/** Edge shape drift: a single `route` point became `waypoints[]`; the
 *  arrowhead flag became a mode. `kind` is never touched — it is semantic
 *  and independent of style. Idempotent on the current shape. */
export function migrateEdge(raw: unknown): ArchEdge {
  const e = { ...((raw ?? {}) as Record<string, unknown>) };
  const style = { ...((e.style as Record<string, unknown> | undefined) ?? {}) } as Record<string, unknown>;
  if (style.arrow === true) style.arrow = "end";
  else if (style.arrow === false) style.arrow = "none";
  for (const k of Object.keys(style)) if (style[k] === undefined) delete style[k];
  if (Object.keys(style).length) e.style = style as EdgeStyle;
  else delete e.style;
  const route = e.route as { x: number; y: number } | undefined;
  if (route && typeof route.x === "number" && !Array.isArray(e.waypoints)) e.waypoints = [{ x: route.x, y: route.y }];
  delete e.route;
  if (Array.isArray(e.waypoints) && (e.waypoints as unknown[]).length === 0) delete e.waypoints;
  if (!e.kind) e.kind = "sync";
  return e as unknown as ArchEdge;
}

export function migrateSnapshot(raw: unknown): StateSnapshot {
  const src = (raw ?? {}) as Record<string, unknown>;
  const nodes = Array.isArray(src.nodes) ? [...(src.nodes as StateSnapshot["nodes"])] : [];
  const edges = Array.isArray(src.edges) ? (src.edges as unknown[]).map(migrateEdge) : [];
  const traffic = (src.traffic as StateSnapshot["traffic"]) ?? { ...DEFAULT_TRAFFIC };

  let containers: Container[] = Array.isArray(src.containers)
    ? [...(src.containers as Container[])]
    : [];
  const sections: Section[] = Array.isArray(src.sections)
    ? [...(src.sections as Section[])]
    : [];

  // ---- v1 shape: groups[] and node.group ----
  const legacy = Array.isArray(src.groups) ? (src.groups as LegacyGroup[]) : [];
  if (legacy.length) {
    const reparent = new Map<string, string | undefined>(); // dissolved id → survivor
    for (const g of legacy) {
      const kind = KIND_MAP[g.kind];
      if (kind === null || kind === undefined) {
        reparent.set(g.id, g.parent);
        if (g.kind === "logical") {
          sections.push({
            id: `section-${g.id}`,
            name: g.name,
            color: "#3B82F6",
            nodeIds: [],
            collapsed: Boolean(g.collapsed),
          });
        }
        continue;
      }
      containers.push({
        id: g.id,
        kind,
        name: g.name,
        cidr: g.cidr,
        parent: g.parent,
        collapsed: Boolean(g.collapsed),
      });
    }
    // resolve parents that pointed at a dissolved group
    const resolve = (p: string | undefined): string | undefined => {
      let cur = p;
      for (let i = 0; cur && reparent.has(cur) && i < 12; i++) cur = reparent.get(cur);
      return cur;
    };
    containers = containers.map((c) => ({ ...c, parent: resolve(c.parent) }));

    for (const n of nodes) {
      const legacyGroup = (n as unknown as { group?: string }).group;
      if (legacyGroup) {
        const section = sections.find((s) => s.id === `section-${legacyGroup}`);
        if (section) section.nodeIds.push(n.id);
        n.container = resolve(legacyGroup);
        delete (n as unknown as { group?: string }).group;
      }
    }
  }

  // ---- drop fields the model no longer carries ----
  for (const n of nodes) delete (n as unknown as { lane?: string }).lane;

  // ---- repair illegal parents rather than dropping the container ----
  const byId = new Map(containers.map((c) => [c.id, c]));
  const kindOf = (id?: string) => (id ? byId.get(id)?.kind ?? null : null);
  containers = containers.map((c) => {
    if (!CONTAINER_KINDS.includes(c.kind)) return c;
    let parent = c.parent;
    for (let i = 0; i < 12; i++) {
      if (LEGAL_PARENTS[c.kind].includes(kindOf(parent))) break;
      parent = parent ? byId.get(parent)?.parent : undefined;
    }
    return { ...c, parent, collapsed: Boolean(c.collapsed) };
  });

  // a node pointing at a container that no longer exists floats to the canvas
  const liveIds = new Set(containers.map((c) => c.id));
  for (const n of nodes) if (n.container && !liveIds.has(n.container)) delete n.container;

  return { nodes, edges, containers, sections, traffic };
}
