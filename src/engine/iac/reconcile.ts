// Reconciliation: what a template says versus what the drawing says.
//
// Export is a one-way door, and this is the door back. It is not a live
// sync · nothing watches a repo and nothing writes to one. It is the thing
// a sync would be built out of: match the two graphs, name every
// difference, then apply the ones you want, in one of two ways.
//
//   replace — the template is the truth. The drawing becomes it.
//   merge   — the template wins wherever it speaks. Resources it does not
//             mention stay, positions stay, sections stay, and settings it
//             says nothing about (traffic, durations, storage · the ones
//             that decide price and have no CloudFormation home) stay.
//
// Which settings a template "states" is the crux. A foreign template says
// a Lambda is arm64 at 512 MB and says nothing about how often it runs; a
// merge that took the whole settings object would silently reset the
// figure the estimate is built on. So only stated keys are compared, and
// only stated keys are applied.

import type { ArchEdge, ArchNode, ServiceId, StateSnapshot } from "../model";
import type { Container } from "../containers";

export interface SettingChange {
  key: string;
  from: unknown;
  to: unknown;
}

export interface NodeDelta {
  kind: "added" | "removed" | "changed" | "same";
  /** The drawing's node id when there is one, else the template's. */
  id: string;
  incomingId?: string;
  service: ServiceId;
  name: string;
  changes: SettingChange[];
}

export interface EdgeDelta {
  kind: "added" | "removed";
  from: string;
  to: string;
  label: string;
}

export interface Reconciliation {
  nodes: NodeDelta[];
  edges: EdgeDelta[];
  counts: { added: number; removed: number; changed: number; same: number };
  /** template node id → drawing node id, for whatever is matched. */
  matched: Record<string, string>;
}

export type MergeMode = "replace" | "merge";

/** Settings a template actually stated, per incoming node id. Absent for a
 *  node = every key it carries counts as stated (our own templates). */
export type StatedSettings = Record<string, string[]>;

const norm = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");

function statedKeys(node: ArchNode, stated?: StatedSettings): string[] {
  const list = stated?.[node.id];
  return list ?? Object.keys(node.settings);
}

export function reconcile(
  current: StateSnapshot,
  incoming: StateSnapshot,
  stated?: StatedSettings,
): Reconciliation {
  const unmatchedCurrent = new Map(current.nodes.map((n) => [n.id, n]));
  const matched: Record<string, string> = {};
  const nodes: NodeDelta[] = [];

  // Same id first (our own template), then service + name.
  const takeById = (id: string) => {
    const n = unmatchedCurrent.get(id);
    if (n) unmatchedCurrent.delete(id);
    return n;
  };
  const takeByName = (service: ServiceId, name: string) => {
    for (const [id, n] of unmatchedCurrent) {
      if (n.service === service && norm(n.name) === norm(name)) {
        unmatchedCurrent.delete(id);
        return n;
      }
    }
    return undefined;
  };

  for (const inc of incoming.nodes) {
    const cur = takeById(inc.id) ?? takeByName(inc.service, inc.name);
    if (!cur) {
      nodes.push({ kind: "added", id: inc.id, incomingId: inc.id, service: inc.service, name: inc.name, changes: [] });
      continue;
    }
    matched[inc.id] = cur.id;
    const changes: SettingChange[] = [];
    if (cur.name !== inc.name) changes.push({ key: "name", from: cur.name, to: inc.name });
    for (const key of statedKeys(inc, stated)) {
      const from = cur.settings[key];
      const to = inc.settings[key];
      if (!Object.is(from, to)) changes.push({ key, from, to });
    }
    nodes.push({
      kind: changes.length ? "changed" : "same",
      id: cur.id,
      incomingId: inc.id,
      service: cur.service,
      name: cur.name,
      changes,
    });
  }

  for (const cur of unmatchedCurrent.values()) {
    nodes.push({ kind: "removed", id: cur.id, service: cur.service, name: cur.name, changes: [] });
  }

  // Edges, compared over the matched nodes only · an edge to a resource
  // that is not in both graphs is already told by that resource's delta.
  const nameOfCurrent = new Map(current.nodes.map((n) => [n.id, n.name]));
  const nameOfIncoming = new Map(incoming.nodes.map((n) => [n.id, n.name]));
  const currentPairs = new Set(current.edges.map((e) => `${e.from}->${e.to}`));
  const incomingPairs = new Set(
    incoming.edges.flatMap((e) => {
      const from = matched[e.from];
      const to = matched[e.to];
      return from && to ? [`${from}->${to}`] : [];
    }),
  );
  const edges: EdgeDelta[] = [];
  for (const e of incoming.edges) {
    const from = matched[e.from];
    const to = matched[e.to];
    if (from && to && currentPairs.has(`${from}->${to}`)) continue;
    edges.push({
      kind: "added",
      from: e.from,
      to: e.to,
      label: `${nameOfIncoming.get(e.from) ?? e.from} → ${nameOfIncoming.get(e.to) ?? e.to}`,
    });
  }
  const inMatched = new Set(Object.values(matched));
  for (const e of current.edges) {
    if (!inMatched.has(e.from) || !inMatched.has(e.to)) continue;
    if (incomingPairs.has(`${e.from}->${e.to}`)) continue;
    edges.push({
      kind: "removed",
      from: e.from,
      to: e.to,
      label: `${nameOfCurrent.get(e.from) ?? e.from} → ${nameOfCurrent.get(e.to) ?? e.to}`,
    });
  }

  return {
    nodes,
    edges,
    counts: {
      added: nodes.filter((n) => n.kind === "added").length,
      removed: nodes.filter((n) => n.kind === "removed").length,
      changed: nodes.filter((n) => n.kind === "changed").length,
      same: nodes.filter((n) => n.kind === "same").length,
    },
    matched,
  };
}

/** Resources a merge brought in arrive without a position (a template has
 *  no geometry). Stack them in a column to the right of everything that is
 *  already drawn, so a merge never lands a pile on the origin and never
 *  moves what the user arranged. */
export function placeNewNodes(snapshot: StateSnapshot, newIds: string[]): StateSnapshot {
  const fresh = new Set(newIds);
  const placed = snapshot.nodes.filter((n) => !fresh.has(n.id));
  const right = placed.length ? Math.max(...placed.map((n) => n.position.x)) + 280 : 80;
  const top = placed.length ? Math.min(...placed.map((n) => n.position.y)) : 80;
  let row = 0;
  return {
    ...snapshot,
    nodes: snapshot.nodes.map((n) =>
      fresh.has(n.id) && n.position.x === 0 && n.position.y === 0
        ? { ...n, position: { x: right, y: top + row++ * 140 } }
        : n,
    ),
  };
}

export function applyReconciliation(
  current: StateSnapshot,
  incoming: StateSnapshot,
  recon: Reconciliation,
  mode: MergeMode,
  stated?: StatedSettings,
): StateSnapshot {
  if (mode === "replace") return incoming;

  const incomingById = new Map(incoming.nodes.map((n) => [n.id, n]));
  const currentById = new Map(current.nodes.map((n) => [n.id, n]));
  const containersById = new Map(current.containers.map((c) => [c.id, c]));
  const incomingContainers = new Map(incoming.containers.map((c) => [c.id, c]));
  const containers: Container[] = current.containers.map((c) => ({ ...c }));

  /** Bring a container and its ancestors across, keeping ids stable. */
  const adopt = (id: string | undefined): string | undefined => {
    if (!id) return undefined;
    if (containersById.has(id)) return id;
    const inc = incomingContainers.get(id);
    if (!inc) return undefined;
    const parent = adopt(inc.parent);
    const copy: Container = { ...inc, parent };
    containersById.set(copy.id, copy);
    containers.push(copy);
    return copy.id;
  };

  const nodes: ArchNode[] = current.nodes.map((n) => ({ ...n, settings: { ...n.settings } }));
  const nodesById = new Map(nodes.map((n) => [n.id, n]));

  for (const delta of recon.nodes) {
    if (delta.kind === "added") {
      const inc = incomingById.get(delta.id);
      if (!inc) continue;
      const copy: ArchNode = {
        ...inc,
        settings: { ...inc.settings },
        container: adopt(inc.container),
        position: { ...inc.position },
      };
      nodes.push(copy);
      nodesById.set(copy.id, copy);
      recon.matched[inc.id] = copy.id;
      continue;
    }
    if (delta.kind !== "changed") continue;
    const cur = nodesById.get(delta.id);
    const inc = delta.incomingId ? incomingById.get(delta.incomingId) : undefined;
    if (!cur || !inc) continue;
    for (const change of delta.changes) {
      if (change.key === "name") cur.name = inc.name;
      else cur.settings[change.key] = inc.settings[change.key];
    }
    // The template may also have moved it into a subnet it states.
    if (inc.container && inc.container !== cur.container) {
      const adopted = adopt(inc.container);
      if (adopted) cur.container = adopted;
    }
    void currentById;
    void stated;
  }

  const edges: ArchEdge[] = current.edges.map((e) => ({ ...e }));
  const pairs = new Set(edges.map((e) => `${e.from}->${e.to}`));
  let seq = edges.length;
  for (const e of incoming.edges) {
    const from = recon.matched[e.from];
    const to = recon.matched[e.to];
    if (!from || !to || from === to) continue;
    const key = `${from}->${to}`;
    if (pairs.has(key)) continue;
    pairs.add(key);
    edges.push({ ...e, id: `edge-merged-${++seq}`, from, to });
  }

  return { ...current, nodes, edges, containers, sections: current.sections.map((s) => ({ ...s })) };
}
