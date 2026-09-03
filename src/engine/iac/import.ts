// One door for everything that arrives as a file.
//
// Three formats read back into a drawing, and they are told apart by what is
// inside them rather than by the extension · two of them are commonly
// `.json`, and a file called `stack.json` is as likely to be a template as a
// saved drawing. Whichever it is, the result has the same shape, so the same
// reconciliation (replace / merge) applies to all three.
//
// The CDK case is the one that needs explaining. Export writes a stack, so
// Import reads one back · but only ours, and not by parsing TypeScript. A
// generated stack carries the drawing in a comment block
// (`exporters/overheadState.ts`), which is the same block a template carries
// in `Metadata.Overhead`, read by the same function. Somebody else's stack is
// a program: it has loops, conditions and environment lookups, and it does
// not say what it builds until it is run. `cdk synth` runs it and prints a
// template, and a template we can read · which is what we say instead of
// failing at it.

import type { StateSnapshot } from "../model";
import { DEFAULT_TRAFFIC } from "../model";
import { migrateSnapshot } from "../migrate";
import { getService, SERVICES } from "../services";
import { defaultSettings } from "../defineService";
import { cdkStateFrom } from "../exporters/overheadState";
import { fromOverheadBlock, importCloudFormation, type ImportResult, type OverheadBlock } from "./cloudformation";

export type ImportFormat = "cloudformation" | "overhead" | "cdk";

export const FORMAT_LABEL: Record<ImportFormat, string> = {
  cloudformation: "CloudFormation",
  overhead: "Overhead file",
  cdk: "CDK stack",
};

/** TypeScript that builds AWS infrastructure · ours or anyone's. */
export function looksLikeCdk(raw: string): boolean {
  const text = raw.slice(0, 4000);
  return (
    /\bfrom\s+["']aws-cdk-lib/.test(text) ||
    /\brequire\(["']aws-cdk-lib/.test(text) ||
    /\bnew\s+(cdk\.)?(App|Stack)\s*\(/.test(text) ||
    /\bextends\s+(cdk\.)?Stack\b/.test(text)
  );
}

const FOREIGN_CDK =
  "This stack was not written by Overhead, and CDK is a program · it does not say what it builds until it is run. Run `cdk synth > template.yaml` in the app and bring that here.";

/** Our generated stack labels every construct `// ── <Service term>: <name>`,
 *  which is enough to rebuild the resources even from a stack exported before
 *  the state block existed. Only what the file says comes back: the services
 *  and their names. Settings, positions and wiring are not in the code we
 *  emit, so they are defaults · the block above is what carries those, and
 *  re-exporting from this build gets them back. */
const MARKER = /^\s*\/\/ ── (.+?): (.+?)\s*$/gm;

function fromCdkMarkers(raw: string): ImportResult | null {
  const byTerm = new Map(Object.values(SERVICES).map((d) => [d.term, d]));
  const nodes: StateSnapshot["nodes"] = [];
  const used = new Set<string>();
  for (const [, term, name] of raw.matchAll(MARKER)) {
    const def = byTerm.get(term.trim());
    if (!def) continue;
    let id = name.trim().replace(/[^a-zA-Z0-9._-]/g, "-").toLowerCase() || def.id;
    while (used.has(id)) id = `${id}-2`;
    used.add(id);
    nodes.push({
      id,
      service: def.id,
      name: name.trim(),
      settings: defaultSettings(def),
      position: { x: nodes.length * 240, y: 0 },
    });
  }
  if (!nodes.length) return null;
  return {
    ok: true,
    snapshot: migrateSnapshot({ nodes, edges: [], containers: [], sections: [], traffic: DEFAULT_TRAFFIC }),
    // The code states the service and the name · nothing else. A merge must
    // not reset settings this file never spoke about.
    stated: Object.fromEntries(nodes.map((n) => [n.id, ["name"]])),
    report: {
      source: "foreign",
      nodes: nodes.length,
      edges: 0,
      containers: 0,
      skipped: [],
      notes: [
        "Read from the construct labels in the code · a stack Overhead wrote before it began carrying the drawing.",
        "Settings are defaults and there are no connections: the generated code does not state them. Re-export this drawing as CDK from this build and it will come back whole.",
      ],
    },
  };
}

/** A stack Overhead generated · the drawing rides in its comment block, and
 *  failing that, in the labels above each construct. */
export function importCdkStack(raw: string): ImportResult {
  const block = cdkStateFrom(raw);
  if (block && Array.isArray((block as OverheadBlock).nodes)) {
    return fromOverheadBlock(block as OverheadBlock, "stack");
  }
  return fromCdkMarkers(raw) ?? { ok: false, code: "cdk_source", message: FOREIGN_CDK };
}

/** What this text is, from its content · null when it is none of them. */
export function detectFormat(raw: string): ImportFormat | null {
  const text = raw.trim();
  if (!text) return null;
  if (looksLikeCdk(text) || cdkStateFrom(text)) return "cdk";
  if (text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      if (parsed && typeof parsed === "object") {
        if (parsed.Resources && typeof parsed.Resources === "object") return "cloudformation";
        if (Array.isArray(parsed.nodes)) return "overhead";
      }
    } catch {
      return null;
    }
    return null;
  }
  // YAML only ever means a template here.
  return /^\s*(AWSTemplateFormatVersion|Resources|Transform|Description)\s*:/m.test(text)
    ? "cloudformation"
    : null;
}

/** An Overhead JSON state file · what the Export dialog writes. */
export function importOverheadState(raw: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, code: "invalid_json", message: "That is not valid JSON." };
  }
  const src = (parsed ?? {}) as Record<string, unknown>;
  if (!Array.isArray(src.nodes)) {
    return {
      ok: false,
      code: "not_a_template",
      message: "No resources in this file · an Overhead file has a `nodes` array.",
    };
  }
  const unknown = (src.nodes as { service?: string }[])
    .map((n) => String(n?.service ?? ""))
    .filter((id) => !getService(id));
  if (unknown.length) {
    return {
      ok: false,
      code: "not_a_template",
      message: `This file names ${unknown.length === 1 ? "a service" : "services"} this build does not have: ${[...new Set(unknown)].join(", ")}.`,
    };
  }
  const snapshot: StateSnapshot = migrateSnapshot({
    nodes: src.nodes,
    edges: src.edges ?? [],
    containers: src.containers ?? src.groups ?? [],
    sections: src.sections ?? [],
    traffic: src.traffic ?? DEFAULT_TRAFFIC,
  });
  const drawing = typeof src.title === "string" ? src.title : typeof src.name === "string" ? src.name : undefined;
  return {
    ok: true,
    snapshot,
    // A saved drawing states everything, positions and all.
    stated: Object.fromEntries(snapshot.nodes.map((n) => [n.id, Object.keys(n.settings)])),
    report: {
      source: "overhead",
      nodes: snapshot.nodes.length,
      edges: snapshot.edges.length,
      containers: snapshot.containers.length,
      skipped: [],
      notes: [
        `A drawing saved from Overhead${drawing ? ` · "${drawing}"` : ""} · positions, containers, sections and settings come back exactly.`,
      ],
    },
  };
}

/** Read a file as `format`, or as whatever it turns out to be. */
export function importAny(
  raw: string,
  opts: { region?: string; format?: ImportFormat } = {},
): ImportResult & { format?: ImportFormat } {
  const detected = detectFormat(raw);
  const format = opts.format ?? detected ?? "cloudformation";
  // A format the user picked themselves is honoured only where the document
  // agrees · a mismatch is reported, never guessed away.
  if (opts.format && detected && detected !== opts.format) {
    return {
      ok: false,
      code: "not_a_template",
      message: `This is ${
        detected === "overhead" ? "an" : "a"
      } ${FORMAT_LABEL[detected]}, not ${opts.format === "overhead" ? "an" : "a"} ${
        FORMAT_LABEL[opts.format]
      } · pick ${FORMAT_LABEL[detected]} on the left.`,
      format: detected,
    };
  }
  const result =
    format === "overhead"
      ? importOverheadState(raw)
      : format === "cdk"
        ? importCdkStack(raw)
        : importCloudFormation(raw, opts);
  return { ...result, format };
}
