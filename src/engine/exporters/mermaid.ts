// Mermaid export: flowchart, node labels carry the monthly figure, the three
// edge kinds keep their encodings (sync solid arrow, async dotted arrow, data
// open link), and containers become nested subgraphs.
//
// This is the one export that is also an *editor* format · `iac/mermaid.ts`
// reads it back, and the Mermaid tab in the right dock round-trips it on
// every keystroke. Two things make that round trip exact rather than
// approximate:
//
//  1. A trailing `%% overhead: {…}` comment carries what Mermaid has no
//     syntax for · which service each node is, what kind of container each
//     subgraph is, the sections, and any id that had to be mangled. The same
//     trick the CDK exporter uses (`exporters/overheadState.ts`): a comment
//     is invisible to every other renderer, so the document stays a plain
//     Mermaid flowchart that mermaid.live will draw.
//  2. Everything the comment does not carry (positions, settings, traffic,
//     edge volumes and styling) is preserved on the way back in by merging
//     **by id**, not by rebuilding · `applyMermaid` in `iac/mermaid.ts`.
//
// Without the comment the document still reads back: services are inferred
// from the labels and unknown labels become flow shapes. That is what makes
// somebody else's hand-written diagram importable at all.

import type { StateSnapshot } from "../model";
import type { PricingTable } from "../pricing";
import { allCosts } from "../cost";
import { toMoney } from "../model";
import { getService } from "../services";

export interface MermaidOpts {
  /** Append `<br/>$x/mo` to each label. Off in the live editor, where the
   *  figure is derived and re-typing it would look like an input. */
  cost?: boolean;
  /** The `%% overhead:` line. Off only for a picture of the document. */
  meta?: boolean;
  /** `LR` (default) or `TD`. */
  direction?: "LR" | "TD";
}

/** Mermaid ids are `[A-Za-z][\w-]*`; ours usually already are. */
export function mmId(id: string, taken?: Set<string>): string {
  let out = id.replace(/[^A-Za-z0-9_-]/g, "_");
  if (!/^[A-Za-z]/.test(out)) out = `n_${out}`;
  if (taken) {
    let candidate = out;
    let n = 2;
    while (taken.has(candidate)) candidate = `${out}_${n++}`;
    taken.add(candidate);
    return candidate;
  }
  return out;
}

function esc(text: string): string {
  return text.replace(/"/g, "#quot;");
}

/** What the metadata comment carries · everything Mermaid cannot say. */
export interface MermaidMeta {
  /** mermaid id → service id. */
  services: Record<string, string>;
  /** subgraph id → container kind. */
  containers: Record<string, string>;
  /** Sections, as ids into the mermaid id space. */
  sections: { name: string; color?: string; kind?: string; nodes: string[] }[];
  /** mermaid id → the real id, only where they differ. */
  ids: Record<string, string>;
}

export const META_PREFIX = "%% overhead: ";

export function exportMermaid(
  snapshot: StateSnapshot,
  pricing: PricingTable,
  opts: MermaidOpts = {},
): string {
  const { cost = true, meta = true, direction = "LR" } = opts;
  const costs = new Map(
    allCosts(snapshot, pricing).map((c) => [c.nodeId, c.monthly]),
  );

  // One id space for nodes and subgraphs · Mermaid shares it.
  const taken = new Set<string>();
  const nodeId = new Map<string, string>();
  const contId = new Map<string, string>();
  for (const n of snapshot.nodes) nodeId.set(n.id, mmId(n.id, taken));
  for (const c of snapshot.containers) contId.set(c.id, mmId(`g_${c.id}`, taken));

  const info: MermaidMeta = { services: {}, containers: {}, sections: [], ids: {} };
  for (const n of snapshot.nodes) {
    const mm = nodeId.get(n.id)!;
    info.services[mm] = n.service;
    if (mm !== n.id) info.ids[mm] = n.id;
  }
  for (const c of snapshot.containers) {
    const mm = contId.get(c.id)!;
    info.containers[mm] = c.kind;
    // Always recorded: a subgraph id is prefixed to keep it out of the
    // nodes' id space, so it never *is* the container's id.
    info.ids[mm] = c.id;
  }
  for (const s of snapshot.sections) {
    info.sections.push({
      name: s.name,
      ...(s.color ? { color: s.color } : {}),
      ...(s.kind && s.kind !== "section" ? { kind: s.kind } : {}),
      nodes: s.nodeIds.map((id) => nodeId.get(id)).filter(Boolean) as string[],
    });
  }

  /** A node line: `id["Name<br/>$1.20/mo"]`, in the shape its family draws. */
  const nodeLine = (id: string): string => {
    const n = snapshot.nodes.find((x) => x.id === id)!;
    const monthly = costs.get(n.id) ?? 0;
    const priced = (getService(n.service)?.family ?? "aws") === "aws";
    const label = esc(n.name) + (cost && priced ? `<br/>$${toMoney(monthly).toFixed(2)}/mo` : "");
    const mm = nodeId.get(n.id)!;
    // The bracket says what the shape is, so a hand-read of the document
    // (or mermaid.live) shows a decision as a diamond and a store as a
    // cylinder · and it is what an inbound document is read back through.
    switch (n.service) {
      case "decision":
        return `${mm}{"${label}"}`;
      case "terminal":
        return `${mm}(["${label}"])`;
      case "actor":
        return `${mm}(("${label}"))`;
      case "store":
        return `${mm}[("${label}")]`;
      case "external":
        return `${mm}[["${label}"]]`;
      default:
        return `${mm}["${label}"]`;
    }
  };

  const lines: string[] = [`flowchart ${direction}`];
  const membersOf = (containerId: string | undefined) =>
    snapshot.nodes.filter((n) => (n.container ?? undefined) === containerId);
  const childrenOf = (parent: string | undefined) =>
    snapshot.containers.filter((c) => (c.parent ?? undefined) === parent);

  const emitContainer = (cId: string, depth: number) => {
    const c = snapshot.containers.find((x) => x.id === cId)!;
    const pad = "  ".repeat(depth);
    lines.push(`${pad}subgraph ${contId.get(c.id)}["${esc(c.name)}"]`);
    for (const n of membersOf(c.id)) lines.push(`${pad}  ${nodeLine(n.id)}`);
    for (const child of childrenOf(c.id)) emitContainer(child.id, depth + 1);
    lines.push(`${pad}end`);
  };

  for (const n of membersOf(undefined)) lines.push(`  ${nodeLine(n.id)}`);
  for (const c of childrenOf(undefined)) emitContainer(c.id, 1);

  // Edges last · a cross-subgraph edge declared inside one of them reads as
  // belonging to it, and Mermaid draws it the same either way.
  for (const e of snapshot.edges) {
    const from = nodeId.get(e.from);
    const to = nodeId.get(e.to);
    if (!from || !to) continue;
    const label = e.label ?? "";
    const l = label ? `|"${esc(label)}"|` : "";
    if (e.kind === "async") lines.push(`  ${from} -.->${l} ${to}`);
    else if (e.kind === "data") lines.push(`  ${from} ---${l} ${to}`);
    else lines.push(`  ${from} -->${l} ${to}`);
  }

  if (meta) lines.push(META_PREFIX + JSON.stringify(info));
  return lines.join("\n") + "\n";
}
