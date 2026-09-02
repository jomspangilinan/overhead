// The Layers tree, as rows. Pure TS so it can be unit-tested.
//
// One list, every object a row: containers nest by ownership; sections
// (and groups) nest *positionally* — a section appears under every
// container that holds one of its members, showing only those members
// there, and at the top level when its members sit outside every frame.
// Sections nest under a parent section (`parentId`) instead. Nodes appear
// under their section when they are in one, else directly under their
// container. Connections close the list.

import type { StateSnapshot, Section, ArchNode, ArchEdge } from "./model";
import type { Container } from "./containers";

export type LayerRow =
  | { key: string; kind: "container"; id: string; depth: number; container: Container; hasChildren: boolean }
  | { key: string; kind: "section" | "group"; id: string; depth: number; section: Section; members: ArchNode[]; hasChildren: boolean }
  | { key: string; kind: "node"; id: string; depth: number; node: ArchNode }
  | { key: string; kind: "connections"; id: "connections"; depth: 0; count: number; hasChildren: boolean }
  | { key: string; kind: "edge"; id: string; depth: 1; edge: ArchEdge };

export function layerRows(snap: StateSnapshot, folded: Set<string>): LayerRow[] {
  const { nodes, containers, sections, edges } = snap;
  const out: LayerRow[] = [];
  const membersOf = (s: Section, containerId: string | undefined) =>
    nodes.filter((n) => s.nodeIds.includes(n.id) && (n.container ?? undefined) === containerId);
  const hasAnyMemberIn = (s: Section, containerId: string | undefined): boolean =>
    membersOf(s, containerId).length > 0 || sections.some((c) => c.parentId === s.id && hasAnyMemberIn(c, containerId));

  const walkSection = (s: Section, containerId: string | undefined, depth: number, scope: string) => {
    const members = membersOf(s, containerId);
    const children = sections.filter((c) => c.parentId === s.id && hasAnyMemberIn(c, containerId));
    const key = `${scope}/${s.id}`;
    out.push({ key, kind: s.kind === "group" ? "group" : "section", id: s.id, depth, section: s, members, hasChildren: members.length + children.length > 0 });
    if (folded.has(key)) return;
    for (const c of children) walkSection(c, containerId, depth + 1, key);
    for (const n of members) out.push({ key: `${key}/${n.id}`, kind: "node", id: n.id, depth: depth + 1, node: n });
  };

  const walkContainer = (containerId: string | undefined, depth: number, scope: string) => {
    for (const c of containers.filter((x) => (x.parent ?? undefined) === containerId)) {
      const key = `${scope}/${c.id}`;
      const kids =
        containers.some((x) => x.parent === c.id) ||
        nodes.some((n) => n.container === c.id) ||
        sections.some((s) => !s.parentId && hasAnyMemberIn(s, c.id));
      out.push({ key, kind: "container", id: c.id, depth, container: c, hasChildren: kids });
      if (!folded.has(key)) walkContainer(c.id, depth + 1, key);
    }
    const roots = sections.filter((s) => !s.parentId && hasAnyMemberIn(s, containerId));
    const covered = new Set<string>();
    const cover = (s: Section) => {
      for (const id of s.nodeIds) covered.add(id);
      for (const c of sections.filter((x) => x.parentId === s.id)) cover(c);
    };
    for (const s of roots) {
      walkSection(s, containerId, depth, scope);
      cover(s);
    }
    for (const n of nodes.filter((x) => (x.container ?? undefined) === containerId && !covered.has(x.id)))
      out.push({ key: `${scope}/${n.id}`, kind: "node", id: n.id, depth, node: n });
  };

  walkContainer(undefined, 0, "");
  // sections with no member anywhere: still objects, listed at the top level
  for (const s of sections.filter((x) => !x.parentId && !nodes.some((n) => x.nodeIds.includes(n.id)) && !sections.some((c) => c.parentId === x.id)))
    out.push({ key: `/${s.id}`, kind: s.kind === "group" ? "group" : "section", id: s.id, depth: 0, section: s, members: [], hasChildren: false });

  if (edges.length) {
    out.push({ key: "/connections", kind: "connections", id: "connections", depth: 0, count: edges.length, hasChildren: true });
    if (!folded.has("/connections")) for (const e of edges) out.push({ key: `/connections/${e.id}`, kind: "edge", id: e.id, depth: 1, edge: e });
  }
  return out;
}

/** Every node id inside a section, through nested sections. */
export function sectionMembersDeep(sections: Section[], id: string): string[] {
  const s = sections.find((x) => x.id === id);
  if (!s) return [];
  const out = new Set(s.nodeIds);
  for (const c of sections.filter((x) => x.parentId === id)) for (const m of sectionMembersDeep(sections, c.id)) out.add(m);
  return [...out];
}
