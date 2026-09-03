// Editing the drawing as a document.
//
// The canvas, the Code panel and the agent are three ways of writing the
// same object, so there is one function that takes a partial document and
// merges it into the drawing. Objects are addressed **by id**, never by
// array index: an agent's copy of the state goes stale the moment a human
// drags something, and `/nodes/2/settings/memoryMb` then edits whatever
// happens to be third. An id survives that.
//
// Three rules, and everything else follows from them:
//
//   Merge, don't replace  — a patch states what changes. Object-valued
//                           fields (settings, position, style, card) merge
//                           one level deep, so touching `memoryMb` does not
//                           wipe `architecture`.
//   Unknown id creates    — with enough to build the thing (a node needs a
//                           service, an edge needs both ends).
//   All or nothing        — an invalid setting rejects the whole patch. A
//                           half-applied document is worse than a refused
//                           one, and the error says which field and why.

import type { ArchEdge, ArchNode, EdgeKind, Section, StateSnapshot, Traffic } from "./model";
import { EDGE_KINDS } from "./model";
import type { Container, ContainerKind } from "./containers";
import { CONTAINER_KINDS, wouldCycle } from "./containers";
import { defaultSettings, validateSetting } from "./defineService";
import { getService, SERVICES } from "./services";
import { removeObjects } from "./remove";
import { migrateSnapshot } from "./migrate";

export interface StatePatch {
  nodes?: Record<string, unknown>[];
  edges?: Record<string, unknown>[];
  containers?: Record<string, unknown>[];
  sections?: Record<string, unknown>[];
  traffic?: Partial<Traffic>;
  /** Ids of resources, frames or sections to delete · edges go by edge id. */
  remove?: string[];
}

export interface PatchChange {
  kind: "added" | "changed" | "removed";
  type: "resource" | "connection" | "container" | "section" | "traffic";
  id: string;
  /** The fields this patch actually changed. */
  fields: string[];
}

export type PatchResult =
  | { ok: true; snapshot: StateSnapshot; changes: PatchChange[] }
  | {
      ok: false;
      code: "no_such_service" | "no_such_node" | "invalid_setting" | "invalid_value" | "would_cycle" | "not_an_object";
      message: string;
      /** Where it went wrong, so the agent can fix that one field. */
      at?: string;
      allowed?: readonly string[];
    };

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

/** Shallow merge, one level deep into plain objects · arrays replace. */
function merge<T extends Record<string, unknown>>(base: T, patch: Record<string, unknown>): T {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    out[k] = isObj(v) && isObj(out[k]) ? { ...(out[k] as object), ...v } : v;
  }
  return out as T;
}

/** Which top-level fields a patch entry actually asks to change. */
function touched(before: Record<string, unknown> | undefined, patch: Record<string, unknown>): string[] {
  return Object.keys(patch).filter(
    (k) => k !== "id" && JSON.stringify(before?.[k]) !== JSON.stringify(patch[k]),
  );
}

let seq = 0;
const nextId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${(seq++).toString(36)}`;

export function applyPatch(snap: StateSnapshot, patch: StatePatch): PatchResult {
  if (!patch || typeof patch !== "object" || Array.isArray(patch))
    return { ok: false, code: "not_an_object", message: "A patch is an object." };

  const changes: PatchChange[] = [];
  const nodes = [...snap.nodes];
  const edges = [...snap.edges];
  const containers = [...snap.containers];
  const sections = [...snap.sections];
  let traffic = snap.traffic;

  // ── resources ───────────────────────────────────────────────────────────
  for (const entry of patch.nodes ?? []) {
    if (!isObj(entry)) return { ok: false, code: "not_an_object", message: "Each node is an object." };
    const id = entry.id === undefined ? undefined : String(entry.id);
    const at = nodes.findIndex((n) => n.id === id);
    const existing = at === -1 ? undefined : nodes[at];
    const service = String(entry.service ?? existing?.service ?? "");
    const def = getService(service);
    if (!def) {
      return {
        ok: false,
        code: "no_such_service",
        message: existing
          ? `"${service}" is not a service.`
          : `A new resource needs a known service. "${service || "(none)"}" is not one.`,
        at: `nodes[${id ?? "new"}].service`,
        allowed: Object.keys(SERVICES),
      };
    }
    // Settings are validated against the schema, exactly as set_property is.
    const incoming = isObj(entry.settings) ? entry.settings : {};
    for (const [k, v] of Object.entries(incoming)) {
      const err = validateSetting(def, k, v);
      if (err) {
        return {
          ok: false,
          code: err.code === "unknown_setting" ? "invalid_setting" : "invalid_value",
          message: err.message,
          at: `nodes[${id ?? entry.name ?? "new"}].settings.${k}`,
          allowed: err.allowed,
        };
      }
    }
    if (existing) {
      const fields = touched(existing as unknown as Record<string, unknown>, entry);
      nodes[at] = merge(existing as unknown as Record<string, unknown>, entry) as unknown as ArchNode;
      if (fields.length) changes.push({ kind: "changed", type: "resource", id: existing.id, fields });
      continue;
    }
    const newNode: ArchNode = {
      id: id ?? nextId(service),
      service: def.id,
      name: String(entry.name ?? id ?? def.term),
      settings: { ...defaultSettings(def), ...incoming },
      position: isObj(entry.position)
        ? { x: Number(entry.position.x ?? 0), y: Number(entry.position.y ?? 0) }
        : { x: 0, y: 0 },
      ...(entry.container !== undefined ? { container: String(entry.container) } : {}),
      ...(isObj(entry.card) ? { card: entry.card as ArchNode["card"] } : {}),
    };
    nodes.push(newNode);
    changes.push({ kind: "added", type: "resource", id: newNode.id, fields: Object.keys(entry) });
  }

  // ── frames ──────────────────────────────────────────────────────────────
  for (const entry of patch.containers ?? []) {
    if (!isObj(entry)) return { ok: false, code: "not_an_object", message: "Each container is an object." };
    const id = entry.id === undefined ? undefined : String(entry.id);
    const at = containers.findIndex((c) => c.id === id);
    const existing = at === -1 ? undefined : containers[at];
    const kind = String(entry.kind ?? existing?.kind ?? "");
    if (!CONTAINER_KINDS.includes(kind as ContainerKind)) {
      return {
        ok: false,
        code: "invalid_value",
        message: `"${kind || "(none)"}" is not a container kind.`,
        at: `containers[${id ?? "new"}].kind`,
        allowed: CONTAINER_KINDS,
      };
    }
    const next: Container = existing
      ? (merge(existing as unknown as Record<string, unknown>, entry) as unknown as Container)
      : {
          id: id ?? nextId(kind),
          kind: kind as ContainerKind,
          name: String(entry.name ?? kind),
          collapsed: entry.collapsed === true,
          ...(entry.parent !== undefined ? { parent: String(entry.parent) } : {}),
          ...(entry.cidr !== undefined ? { cidr: String(entry.cidr) } : {}),
          ...(isObj(entry.bounds) ? { bounds: entry.bounds as Container["bounds"] } : {}),
        };
    // Only a cycle is refused · every other nesting is allowed by design.
    if (next.parent && wouldCycle(containers, next.id, next.parent)) {
      return {
        ok: false,
        code: "would_cycle",
        message: `"${next.id}" cannot sit inside itself.`,
        at: `containers[${next.id}].parent`,
      };
    }
    if (existing) {
      const fields = touched(existing as unknown as Record<string, unknown>, entry);
      containers[at] = next;
      if (fields.length) changes.push({ kind: "changed", type: "container", id: next.id, fields });
    } else {
      containers.push(next);
      changes.push({ kind: "added", type: "container", id: next.id, fields: Object.keys(entry) });
    }
  }

  // ── sections ────────────────────────────────────────────────────────────
  for (const entry of patch.sections ?? []) {
    if (!isObj(entry)) return { ok: false, code: "not_an_object", message: "Each section is an object." };
    const id = entry.id === undefined ? undefined : String(entry.id);
    const at = sections.findIndex((x) => x.id === id);
    const existing = at === -1 ? undefined : sections[at];
    const next: Section = existing
      ? (merge(existing as unknown as Record<string, unknown>, entry) as unknown as Section)
      : {
          id: id ?? nextId("section"),
          name: String(entry.name ?? "Section"),
          color: String(entry.color ?? "#8FB8FF"),
          nodeIds: Array.isArray(entry.nodeIds) ? entry.nodeIds.map(String) : [],
          collapsed: entry.collapsed === true,
          ...(entry.kind === "group" ? { kind: "group" as const } : {}),
          ...(entry.parentId !== undefined ? { parentId: String(entry.parentId) } : {}),
          ...(isObj(entry.bounds) ? { bounds: entry.bounds as Section["bounds"] } : {}),
          ...(isObj(entry.style) ? { style: entry.style as Section["style"] } : {}),
        };
    if (existing) {
      const fields = touched(existing as unknown as Record<string, unknown>, entry);
      sections[at] = next;
      if (fields.length) changes.push({ kind: "changed", type: "section", id: next.id, fields });
    } else {
      sections.push(next);
      changes.push({ kind: "added", type: "section", id: next.id, fields: Object.keys(entry) });
    }
  }

  // ── connections ─────────────────────────────────────────────────────────
  for (const entry of patch.edges ?? []) {
    if (!isObj(entry)) return { ok: false, code: "not_an_object", message: "Each edge is an object." };
    const id = entry.id === undefined ? undefined : String(entry.id);
    const at = edges.findIndex((e) => e.id === id);
    const existing = at === -1 ? undefined : edges[at];
    const from = String(entry.from ?? existing?.from ?? "");
    const to = String(entry.to ?? existing?.to ?? "");
    for (const [end, who] of [["from", from], ["to", to]] as const) {
      if (!nodes.some((n) => n.id === who)) {
        return {
          ok: false,
          code: "no_such_node",
          message: `No resource "${who || "(none)"}" to connect ${end === "from" ? "from" : "to"}.`,
          at: `edges[${id ?? "new"}].${end}`,
        };
      }
    }
    const kind = String(entry.kind ?? existing?.kind ?? "sync");
    if (!EDGE_KINDS.includes(kind as EdgeKind)) {
      return {
        ok: false,
        code: "invalid_value",
        message: `"${kind}" is not a connection kind.`,
        at: `edges[${id ?? "new"}].kind`,
        allowed: EDGE_KINDS,
      };
    }
    const next = { ...(existing ?? {}), ...entry, id: id ?? nextId("edge"), from, to, kind } as ArchEdge;
    if (existing) {
      const fields = touched(existing as unknown as Record<string, unknown>, entry);
      edges[at] = next;
      if (fields.length) changes.push({ kind: "changed", type: "connection", id: next.id, fields });
    } else {
      edges.push(next);
      changes.push({ kind: "added", type: "connection", id: next.id, fields: Object.keys(entry) });
    }
  }

  // ── traffic ─────────────────────────────────────────────────────────────
  if (isObj(patch.traffic)) {
    const fields = touched(traffic as unknown as Record<string, unknown>, patch.traffic);
    traffic = { ...traffic, ...patch.traffic };
    if (fields.length) changes.push({ kind: "changed", type: "traffic", id: "traffic", fields });
  }

  // ── removals ────────────────────────────────────────────────────────────
  let next: StateSnapshot = { nodes, edges, containers, sections, traffic };
  const gone = (patch.remove ?? []).map(String);
  if (gone.length) {
    const known = new Set([
      ...nodes.map((n) => n.id),
      ...containers.map((c) => c.id),
      ...sections.map((x) => x.id),
    ]);
    for (const id of gone) {
      if (known.has(id)) {
        changes.push({ kind: "removed", type: "resource", id, fields: [] });
        continue;
      }
      const edge = edges.find((e) => e.id === id);
      if (edge) {
        changes.push({ kind: "removed", type: "connection", id, fields: [] });
        continue;
      }
      return { ok: false, code: "no_such_node", message: `Nothing here is called "${id}".`, at: "remove" };
    }
    next = removeObjects(next, { ids: gone.filter((id) => known.has(id)) });
    const edgeIds = new Set(gone);
    next = { ...next, edges: next.edges.filter((e) => !edgeIds.has(e.id)) };
  }

  // The same repair every document gets on the way in: dangling parents cut,
  // cycles broken, old shapes migrated.
  return { ok: true, snapshot: migrateSnapshot(next), changes };
}

/** One line per change · what the notice and the tool both say. */
export function describeChanges(changes: PatchChange[]): string {
  const n = (kind: PatchChange["kind"]) => changes.filter((c) => c.kind === kind).length;
  const parts = [
    n("added") ? `${n("added")} added` : "",
    n("changed") ? `${n("changed")} changed` : "",
    n("removed") ? `${n("removed")} removed` : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "nothing changed";
}

// ── The other direction: what changed, as a patch ──────────────────────────
//
// A room broadcasts what you did, not what you have. `diffSnapshots` turns
// "the store changed" into the same partial document `patch_state` takes, so
// a human dragging a node and an agent calling a tool put the identical shape
// on the wire · and two people touching different resources merge, because
// every entry is addressed by id.
//
// Whole objects, not per-field deltas: an object is small, and a field-level
// diff would need a vector clock to be worth anything. This is a relay, not
// a CRDT · say so plainly rather than implying more.

const byId = <T extends { id: string }>(list: T[]) => new Map(list.map((x) => [x.id, x]));

/** `next` expressed as changes against `prev` · null when nothing moved. */
export function diffSnapshots(prev: StateSnapshot, next: StateSnapshot): StatePatch | null {
  const patch: StatePatch = {};
  const remove: string[] = [];

  const pick = <T extends { id: string }>(before: T[], after: T[]): T[] => {
    const was = byId(before);
    const out = after.filter((x) => JSON.stringify(was.get(x.id)) !== JSON.stringify(x));
    const now = byId(after);
    for (const x of before) if (!now.has(x.id)) remove.push(x.id);
    return out;
  };

  const nodes = pick(prev.nodes, next.nodes);
  const edges = pick(prev.edges, next.edges);
  const containers = pick(prev.containers, next.containers);
  const sections = pick(prev.sections, next.sections);

  if (nodes.length) patch.nodes = nodes as unknown as Record<string, unknown>[];
  if (edges.length) patch.edges = edges as unknown as Record<string, unknown>[];
  if (containers.length) patch.containers = containers as unknown as Record<string, unknown>[];
  if (sections.length) patch.sections = sections as unknown as Record<string, unknown>[];
  if (JSON.stringify(prev.traffic) !== JSON.stringify(next.traffic)) patch.traffic = next.traffic;
  if (remove.length) patch.remove = remove;

  return Object.keys(patch).length ? patch : null;
}
