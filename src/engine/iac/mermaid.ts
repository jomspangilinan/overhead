// Mermaid, read back into a drawing.
//
// The fourth format, and the only one that is not AWS to begin with. Two
// documents arrive here and both have to work:
//
//  * **Ours** · what `exporters/mermaid.ts` writes, with a trailing
//    `%% overhead: {…}` comment naming the service behind every node, the
//    kind of every subgraph and the sections. That comes back exactly.
//  * **Anybody's** · a flowchart typed by hand or pasted out of a README.
//    There is no metadata, so the document is read for what it says: the
//    bracket around a label is its shape, and the label itself is matched
//    against the service vocabulary. `[Lambda]` becomes a priced AWS Lambda;
//    `{approved?}` becomes a decision; a label that matches nothing stays a
//    plain step. **That is the point** · a diagram somebody drew as a picture
//    arrives here as a design and starts carrying a number.
//
// Nothing about positions is in a Mermaid document, so an import is always
// laid out (`report.source` is "foreign", which is what the Import dialog
// reads to decide). The live Mermaid tab does not go through here for
// geometry either · it merges by id through `applyMermaid` below, which is
// what keeps a drag from being undone by the next keystroke.

import type { ArchEdge, ArchNode, EdgeKind, ServiceId, StateSnapshot } from "../model";
import { DEFAULT_TRAFFIC } from "../model";
import type { Container, ContainerKind } from "../containers";
import { migrateSnapshot } from "../migrate";
import { defaultSettings } from "../defineService";
import { getService, SERVICES } from "../services";
import { META_PREFIX, type MermaidMeta } from "../exporters/mermaid";
import { serviceFromIconUrl } from "../services/iconFiles";
import type { ImportResult } from "./cloudformation";
import { placeNewNodes } from "./reconcile";

/** A flowchart, whoever wrote it. */
export function looksLikeMermaid(raw: string): boolean {
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("%%")) continue;
    return /^(flowchart|graph)\b/.test(t);
  }
  return false;
}

/* ── the shapes ──────────────────────────────────────────────────────── */

type Shape = "rect" | "round" | "stadium" | "circle" | "cylinder" | "subroutine" | "diamond" | "flag";

/** Mermaid's bracket vocabulary, longest first so `[(` is not read as `[`. */
const BRACKETS: { open: string; close: string; shape: Shape }[] = [
  { open: "[(", close: ")]", shape: "cylinder" },
  { open: "((", close: "))", shape: "circle" },
  { open: "[[", close: "]]", shape: "subroutine" },
  { open: "([", close: "])", shape: "stadium" },
  { open: "{{", close: "}}", shape: "diamond" },
  { open: "[", close: "]", shape: "rect" },
  { open: "(", close: ")", shape: "round" },
  { open: "{", close: "}", shape: "diamond" },
  { open: ">", close: "]", shape: "flag" },
];

/** What a shape means when nothing else does · the flow vocabulary. */
const SHAPE_SERVICE: Record<Shape, ServiceId> = {
  rect: "step",
  round: "step",
  stadium: "terminal",
  circle: "actor",
  cylinder: "store",
  subroutine: "external",
  diamond: "decision",
  flag: "step",
};

/* ── reading a label as a service ────────────────────────────────────── */

// Ordered · the first hit wins, so "api gateway" is matched before "api" and
// "kinesis firehose" before "kinesis". Keys are matched against the label
// lower-cased, with punctuation flattened to spaces.
const KEYWORDS: [string, ServiceId][] = [
  ["api gateway", "apigateway"],
  ["apigateway", "apigateway"],
  ["http api", "apigateway"],
  ["rest api", "apigateway"],
  ["lambda", "lambda"],
  ["dynamodb", "dynamodb"],
  ["dynamo", "dynamodb"],
  ["cloudfront", "cloudfront"],
  ["cdn", "cloudfront"],
  ["s3", "s3"],
  ["bucket", "s3"],
  ["sqs", "sqs"],
  ["queue", "sqs"],
  ["sns", "sns"],
  ["topic", "sns"],
  ["eventbridge", "eventbridge"],
  ["event bus", "eventbridge"],
  ["step functions", "stepfunctions"],
  ["stepfunctions", "stepfunctions"],
  ["state machine", "stepfunctions"],
  ["cognito", "cognito"],
  ["user pool", "cognito"],
  ["firehose", "firehose"],
  ["kinesis", "kinesis"],
  ["secrets manager", "secretsmanager"],
  ["secretsmanager", "secretsmanager"],
  ["parameter store", "ssmparameter"],
  ["kms", "kms"],
  ["cloudwatch", "cloudwatchlogs"],
  ["log group", "cloudwatchlogs"],
];

/** The AWS service a label names, if it names one. Deliberately conservative:
 *  a label that matches nothing becomes a shape, and a shape can be changed
 *  in the Inspector · a wrong service quietly carries a wrong price. */
export function serviceFromLabel(label: string): ServiceId | null {
  const flat = ` ${label.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
  for (const [key, id] of KEYWORDS) if (flat.includes(` ${key} `)) return id;
  // "AWS Lambda" as the service's own term, and the ids themselves.
  for (const def of Object.values(SERVICES)) {
    if (flat.includes(` ${def.term.toLowerCase()} `)) return def.id;
  }
  return null;
}

/** A subgraph title that names a container kind · "VPC", "AWS Cloud",
 *  "private subnet". Only used when the metadata comment is absent. */
function kindFromTitle(title: string): ContainerKind | null {
  const t = title.toLowerCase();
  if (/\bvpc\b/.test(t)) return "vpc";
  if (/\bprivate\b/.test(t) && /\bsubnet\b/.test(t)) return "subnetpri";
  if (/\bpublic\b/.test(t) && /\bsubnet\b/.test(t)) return "subnetpub";
  if (/\bsubnet\b/.test(t)) return "subnetpub";
  if (/\bregion\b/.test(t) || /^[a-z]{2}-[a-z]+-\d$/.test(t.trim())) return "region";
  if (/\bcloud\b/.test(t) || /\baws\b/.test(t)) return "cloud";
  return null;
}

/* ── the parser ──────────────────────────────────────────────────────── */

interface ParsedNode {
  mm: string;
  label?: string;
  shape?: Shape;
  /** An image node's URL · names the service when nothing else does. */
  img?: string;
  /** The subgraph it was declared in, if any. */
  scope?: string;
}
interface ParsedEdge {
  from: string;
  to: string;
  kind: EdgeKind;
  label?: string;
}
interface ParsedGroup {
  mm: string;
  title: string;
  parent?: string;
}

/** Connectors, longest first · a `-.->` must not be read as `--`. */
const CONNECTORS: [string, EdgeKind][] = [
  ["-.->", "async"],
  ["<-->", "sync"],
  ["==>", "sync"],
  ["-->", "sync"],
  ["-.-", "data"],
  ["===", "data"],
  ["---", "data"],
  ["--", "data"],
  ["==", "data"],
];

/** `A -- text --> B` and `A -. text .-> B` written the other way, so the
 *  splitter only ever has to know about `connector|label|`. */
function normaliseInlineLabels(line: string): string {
  return line
    .replace(/-\.\s+([^.]+?)\s+\.->/g, (_m, t) => `-.->|${t.trim()}|`)
    .replace(/==\s+([^=]+?)\s+==>/g, (_m, t) => `==>|${t.trim()}|`)
    .replace(/--\s+([^->]+?)\s+-->/g, (_m, t) => `-->|${t.trim()}|`);
}

function stripQuotes(s: string): string {
  const t = s.trim();
  return t.startsWith('"') && t.endsWith('"') && t.length > 1 ? t.slice(1, -1) : t;
}

/** The label Mermaid shows, as a resource name: `<br/>` and any costed
 *  suffix our own exporter added are not part of the name. */
function cleanLabel(raw: string): string {
  return stripQuotes(raw)
    .replace(/#quot;/g, '"')
    .split(/<br\s*\/?>/i)[0]
    .replace(/<[^>]+>/g, "")
    // The image-node form of the same suffix: `name · $1.20/mo`.
    .replace(/\s*·\s*\$[\d.,]+\/(mo|yr)\s*$/, "")
    .trim();
}

/** `@{ img: "…", label: "…", w: 56 }` · Mermaid's node-metadata block, which
 *  is how an icon travels to a renderer that has never heard of us. Read as
 *  the flat key/value list it is rather than as YAML: the exporter writes it
 *  on one line, and one that spans lines is a document for a Mermaid parser
 *  to complain about, not for us to guess at. */
function readMeta(block: string): { label?: string; img?: string } {
  const out: { label?: string; img?: string } = {};
  for (const [, key, quoted, bare] of block.matchAll(
    /([A-Za-z_]+)\s*:\s*(?:"([^"]*)"|([^,}\s][^,}]*))/g,
  )) {
    const value = (quoted ?? bare ?? "").trim();
    if (key === "label") out.label = value;
    if (key === "img") out.img = value;
  }
  return out;
}

/** An id may contain a hyphen (`orders-api`) but must not eat the connector
 *  in `A-->B`, so a hyphen only continues the id when a word character
 *  follows it. */
const ID = /^[A-Za-z0-9_]+(?:-[A-Za-z0-9_]+)*/;

/** One node token at `i`: an id, optionally followed by a bracketed label. */
function readNode(text: string, i: number): { node: ParsedNode; end: number } | null {
  const idMatch = ID.exec(text.slice(i));
  if (!idMatch) return null;
  const mm = idMatch[0];
  const end = i + mm.length;
  if (text.startsWith("@{", end)) {
    const close = text.indexOf("}", end);
    if (close !== -1) {
      const { label, img } = readMeta(text.slice(end + 2, close));
      return {
        node: {
          mm,
          label: label !== undefined ? cleanLabel(label) : undefined,
          shape: "rect",
          ...(img ? { img } : {}),
        },
        end: close + 1,
      };
    }
  }
  for (const b of BRACKETS) {
    if (text.startsWith(b.open, end)) {
      const close = text.indexOf(b.close, end + b.open.length);
      if (close === -1) continue;
      return {
        node: { mm, label: cleanLabel(text.slice(end + b.open.length, close)), shape: b.shape },
        end: close + b.close.length,
      };
    }
  }
  return { node: { mm }, end };
}

interface Parsed {
  nodes: Map<string, ParsedNode>;
  edges: ParsedEdge[];
  groups: ParsedGroup[];
  /** subgraph id → member node ids, in declaration order. */
  members: Map<string, string[]>;
  meta: MermaidMeta | null;
  direction: string;
}

export function parseMermaid(raw: string): Parsed | null {
  if (!looksLikeMermaid(raw)) return null;
  const nodes = new Map<string, ParsedNode>();
  const edges: ParsedEdge[] = [];
  const groups: ParsedGroup[] = [];
  const members = new Map<string, string[]>();
  let meta: MermaidMeta | null = null;
  let direction = "LR";
  const scope: string[] = [];
  let anon = 0;

  const note = (n: ParsedNode) => {
    const existing = nodes.get(n.mm);
    if (!existing) {
      nodes.set(n.mm, { ...n, scope: scope[scope.length - 1] });
      if (scope.length) members.get(scope[scope.length - 1])!.push(n.mm);
      return;
    }
    // A later mention with a label wins · `A --> B` then `B["Worker"]`.
    if (n.label !== undefined) {
      existing.label = n.label;
      existing.shape = n.shape;
      if (n.img) existing.img = n.img;
    }
    // Naming a node again inside a subgraph is how Mermaid puts an
    // already-declared node in one · which is how most people write it,
    // edges first and the grouping underneath.
    const here = scope[scope.length - 1];
    if (here && !existing.scope) {
      existing.scope = here;
      members.get(here)!.push(n.mm);
    }
  };

  for (const rawLine of raw.split("\n")) {
    let line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith(META_PREFIX)) {
      try {
        meta = JSON.parse(line.slice(META_PREFIX.length)) as MermaidMeta;
      } catch {
        meta = null;
      }
      continue;
    }
    if (line.startsWith("%%")) continue;
    const header = /^(?:flowchart|graph)\s+([A-Za-z]{2})?/.exec(line);
    if (header) {
      if (header[1]) direction = header[1].toUpperCase();
      continue;
    }
    if (/^(classDef|class|style|linkStyle|click|linkStyle)\b/.test(line)) continue;
    if (/^end\b/.test(line)) {
      scope.pop();
      continue;
    }
    const sub = /^subgraph\s+(.*)$/.exec(line);
    if (sub) {
      const rest = sub[1].trim();
      const withId = readNode(rest, 0);
      let mm: string;
      let title: string;
      if (withId && withId.node.label !== undefined) {
        mm = withId.node.mm;
        title = withId.node.label;
      } else if (withId && withId.end === rest.length && /^[A-Za-z0-9_-]+$/.test(rest)) {
        mm = rest;
        title = rest;
      } else {
        // `subgraph Order pipeline` · a bare title with spaces.
        mm = `sub_${++anon}`;
        title = stripQuotes(rest);
      }
      groups.push({ mm, title, parent: scope[scope.length - 1] });
      members.set(mm, []);
      scope.push(mm);
      continue;
    }

    // A statement line: one node, or a chain of them joined by connectors ·
    // `A --> B -.-> C` is two edges, and Mermaid allows any number.
    line = normaliseInlineLabels(line);
    let i = 0;
    let left = readNode(line, i);
    if (!left) continue;
    note(left.node);
    i = left.end;
    for (let guard = 0; guard < 100; guard++) {
      const ws = /^\s*/.exec(line.slice(i))![0].length;
      const conn = CONNECTORS.find((c) => line.startsWith(c[0], i + ws));
      if (!conn) break;
      i += ws + conn[0].length;
      let label: string | undefined;
      const lab = /^\s*\|([^|]*)\|/.exec(line.slice(i));
      if (lab) {
        label = cleanLabel(lab[1]);
        i += lab[0].length;
      }
      i += /^\s*/.exec(line.slice(i))![0].length;
      const right = readNode(line, i);
      if (!right) break;
      note(right.node);
      edges.push({
        from: left.node.mm,
        to: right.node.mm,
        kind: conn[1],
        label: label || undefined,
      });
      i = right.end;
      left = right;
    }
  }

  return { nodes, edges, groups, members, meta, direction };
}

/* ── the drawing ─────────────────────────────────────────────────────── */

export function importMermaid(raw: string): ImportResult {
  const parsed = parseMermaid(raw);
  if (!parsed) {
    return {
      ok: false,
      code: "not_a_template",
      message: "This does not start with `flowchart` or `graph` · a Mermaid document does.",
    };
  }
  if (!parsed.nodes.size) {
    return {
      ok: false,
      code: "not_a_template",
      message: "No nodes in this flowchart · nothing to draw.",
    };
  }

  const meta = parsed.meta;
  const realId = (mm: string) => meta?.ids?.[mm] ?? mm;
  const nodes: ArchNode[] = [];
  const statedServices: string[] = [];
  let matched = 0;
  let shaped = 0;

  for (const [mm, n] of parsed.nodes) {
    const fromMeta = meta?.services?.[mm];
    const named =
      (fromMeta && getService(fromMeta) ? (fromMeta as ServiceId) : null) ??
      // An icon URL names its service outright · which is what lets a
      // document whose `%% overhead:` line was deleted still come back with
      // its Lambdas as Lambdas.
      (n.img ? serviceFromIconUrl(n.img) : null) ??
      serviceFromLabel(n.label ?? mm);
    // The shape is a fallback, not a statement · `[Worker]` says "a box",
    // and a box is what a node becomes only when it did not already exist.
    const service = named ?? SHAPE_SERVICE[n.shape ?? "rect"];
    if (named) statedServices.push(realId(mm));
    const def = getService(service)!;
    if ((def.family ?? "aws") === "aws") matched++;
    else shaped++;
    nodes.push({
      id: realId(mm),
      service,
      name: n.label || mm,
      settings: defaultSettings(def),
      position: { x: nodes.length * 240, y: 0 },
    });
  }

  // A subgraph is a container when the metadata says so, or when its title
  // names a kind. Otherwise it is a section · a grouping somebody drew, which
  // is exactly what a section is for and what is never validated.
  const containers: Container[] = [];
  const sectionsFromGroups: { name: string; nodes: string[] }[] = [];
  const containerOf = new Set<string>();
  for (const g of parsed.groups) {
    const metaKind = meta?.containers?.[g.mm];
    const kind = (metaKind as ContainerKind | undefined) ?? kindFromTitle(g.title);
    if (kind) {
      containers.push({
        id: realId(g.mm),
        kind,
        name: g.title,
        parent: g.parent && containerOf.has(g.parent) ? realId(g.parent) : undefined,
        collapsed: false,
      });
      containerOf.add(g.mm);
    } else {
      sectionsFromGroups.push({ name: g.title, nodes: parsed.members.get(g.mm) ?? [] });
    }
  }
  // Membership: the innermost container a node was declared in.
  for (const [mm, n] of parsed.nodes) {
    let scope = n.scope;
    while (scope && !containerOf.has(scope)) {
      scope = parsed.groups.find((g) => g.mm === scope)?.parent;
    }
    if (scope) {
      const node = nodes.find((x) => x.id === realId(mm));
      if (node) node.container = realId(scope);
    }
  }

  const sections: StateSnapshot["sections"] = [];
  const pushSection = (name: string, ids: string[], color?: string, kind?: string) => {
    const nodeIds = ids.map(realId).filter((id) => nodes.some((n) => n.id === id));
    if (!nodeIds.length) return;
    sections.push({
      id: `sec-${sections.length + 1}`,
      name,
      color: color ?? "#6FE3B0",
      ...(kind === "group" ? { kind: "group" as const } : {}),
      nodeIds,
      collapsed: false,
    });
  };
  if (meta?.sections?.length) {
    for (const s of meta.sections) pushSection(s.name, s.nodes, s.color, s.kind);
  }
  for (const s of sectionsFromGroups) pushSection(s.name, s.nodes);

  const edges: ArchEdge[] = [];
  parsed.edges.forEach((e, i) => {
    const from = realId(e.from);
    const to = realId(e.to);
    if (!nodes.some((n) => n.id === from) || !nodes.some((n) => n.id === to)) return;
    edges.push({ id: `e${i + 1}`, from, to, kind: e.kind, ...(e.label ? { label: e.label } : {}) });
  });

  const notes: string[] = [];
  if (meta) notes.push("This document was written by Overhead · services and grouping came back exactly.");
  else if (matched)
    notes.push(
      `${matched} label${matched === 1 ? "" : "s"} matched an AWS service and ${matched === 1 ? "is" : "are"} priced; ${shaped} stayed as flow shapes.`,
    );
  else notes.push("No label named an AWS service · everything came in as a flow shape, unpriced.");
  notes.push("Mermaid carries no positions, so the drawing is laid out on arrival.");

  return {
    ok: true,
    snapshot: migrateSnapshot({
      nodes,
      edges,
      containers,
      sections,
      traffic: DEFAULT_TRAFFIC,
    }),
    report: {
      // Never "overhead": even our own Mermaid has no geometry in it, and
      // `source` is what the Import dialog reads to decide whether to lay
      // the drawing out.
      source: "foreign",
      nodes: nodes.length,
      edges: edges.length,
      containers: containers.length,
      skipped: [],
      notes,
    },
    // Mermaid states a name, a service and a connection · no settings. A
    // merge must not reset what the document never spoke about.
    stated: Object.fromEntries(nodes.map((n) => [n.id, [] as string[]])),
    statedServices,
  };
}

/* ── the live editor ─────────────────────────────────────────────────── */

/**
 * The Mermaid tab's writer: an edited document applied to the drawing that is
 * already on the canvas.
 *
 * An import rebuilds; this merges, and it merges **by id** for the same
 * reason `patch_state` does. A Mermaid document says what exists, what it is
 * called and what connects to what. It says nothing about where a node sits,
 * what it is configured as, or how thick an edge is · so those come from the
 * node that is already there, and only what the text actually states is
 * written. Delete a line and the node goes; rename one and only the name
 * moves; drag a node while the text is untouched and the drag survives the
 * next keystroke.
 *
 * Edges keep their identity by endpoint (a Mermaid edge has no id), which is
 * what preserves a hand-drawn waypoint and a volume through an edit.
 */
export function applyMermaid(
  current: StateSnapshot,
  incoming: StateSnapshot,
  statedServices?: string[],
): StateSnapshot {
  // A service is only changed where the document actually named one. Without
  // this, a node called "worker" would be demoted from a Lambda to a plain
  // step the moment the metadata line was deleted · the label names no
  // service, so the shape would answer for it.
  const named = statedServices ? new Set(statedServices) : null;
  const byId = new Map(current.nodes.map((n) => [n.id, n]));
  const fresh: string[] = [];
  const nodes = incoming.nodes.map((n) => {
    const old = byId.get(n.id);
    if (!old) {
      // No position in the text, so none is invented here · the node is
      // parked at the origin and placed to the right of the drawing below.
      fresh.push(n.id);
      return { ...n, position: { x: 0, y: 0 } };
    }
    return {
      ...old,
      name: n.name,
      // A service change is a real edit · the settings of the old service do
      // not survive it, because they are not its settings.
      ...(old.service === n.service || (named && !named.has(n.id))
        ? {}
        : { service: n.service, settings: n.settings }),
      container: n.container ?? old.container,
    };
  });

  const key = (e: { from: string; to: string }) => `${e.from}→${e.to}`;
  const oldEdges = new Map<string, (typeof current.edges)[number]>();
  for (const e of current.edges) if (!oldEdges.has(key(e))) oldEdges.set(key(e), e);
  const edges = incoming.edges.map((e) => {
    const old = oldEdges.get(key(e));
    if (!old) return e;
    return { ...old, kind: e.kind, label: e.label ?? old.label };
  });

  return placeNewNodes(
    {
      ...current,
      nodes,
      edges,
      // A subgraph is the only grouping the text states. Containers keep
      // their bounds where they survive, so a resized VPC is not reset by a
      // keystroke somewhere else in the document.
      containers: incoming.containers.map((c) => {
        const old = current.containers.find((x) => x.id === c.id);
        return old ? { ...old, kind: c.kind, name: c.name, parent: c.parent } : c;
      }),
      sections: incoming.sections.map((s) => {
        const old = current.sections.find((x) => x.id === s.id || x.name === s.name);
        return old ? { ...old, nodeIds: s.nodeIds, name: s.name } : s;
      }),
    },
    fresh,
  );
}
