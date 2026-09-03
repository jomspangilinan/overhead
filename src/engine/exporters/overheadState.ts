// The drawing, written next to whatever we generate.
//
// An exported artefact is a lossy view of the model: a template says a
// Lambda is 512 MB but not how often it runs, and neither a template nor a
// stack has anywhere to put a position, a container or a section. So every
// artefact Overhead writes carries the drawing alongside it · CloudFormation
// in `Metadata.Overhead`, CDK in a comment block · and reading either one
// back is the same operation on the same object.
//
// One builder, one reader (`iac/cloudformation.ts` `fromOverheadBlock`), so
// the two exporters cannot drift into carrying different things.

import type { StateSnapshot } from "../model";
import { toMoney } from "../model";
import type { PricingTable } from "../pricing";
import { monthlyTotal } from "../cost";

export const OVERHEAD_METADATA_KEY = "Overhead";
export const OVERHEAD_STATE_VERSION = 1;

export interface StateBlockOpts {
  /** The drawing's name. */
  drawing: string;
  /** What the reader has to replace before deploying. */
  stubs: string[];
  /** The generated file's own id for a node · a logical id, a variable name. */
  idFor?: (nodeId: string) => Record<string, unknown>;
}

/** The block both exporters embed and the importer reads. */
export function overheadStateBlock(
  snapshot: StateSnapshot,
  pricing: PricingTable,
  { drawing, stubs, idFor }: StateBlockOpts,
): Record<string, unknown> {
  return {
    version: OVERHEAD_STATE_VERSION,
    drawing,
    region: pricing.region,
    estimatedMonthlyUsd: toMoney(monthlyTotal(snapshot, pricing)),
    generator: "https://overhead-ecru.vercel.app",
    stubs,
    traffic: snapshot.traffic,
    containers: snapshot.containers,
    sections: snapshot.sections,
    nodes: snapshot.nodes.map((n) => ({
      id: n.id,
      ...(idFor?.(n.id) ?? {}),
      service: n.service,
      name: n.name,
      container: n.container,
      position: n.position,
      settings: n.settings,
      ...(n.card ? { card: n.card } : {}),
    })),
    edges: snapshot.edges,
  };
}

// ── The CDK carrier ───────────────────────────────────────────────────────
//
// A `.ts` file has no metadata section, so the block rides in a comment:
// inert at synth time, readable by eye, and stripped back to JSON by one
// regex. Pretty-printed rather than packed onto one line, because a stack
// lives in a repo and a 40KB single line is a diff nobody can review.

export const CDK_STATE_BEGIN = "// ─── Overhead state · begin ───";
export const CDK_STATE_END = "// ─── Overhead state · end ───";

/** The comment block appended to an exported stack. */
export function cdkStateComment(block: Record<string, unknown>): string {
  const body = JSON.stringify(block, null, 2)
    .split("\n")
    .map((l) => `// ${l}`)
    .join("\n");
  return [
    CDK_STATE_BEGIN,
    "// The drawing this stack was generated from · comments only, so it",
    "// changes nothing at synth time. It is what lets Overhead read the",
    "// stack back with its positions, containers, sections and traffic.",
    "// Delete it and the stack still deploys; the drawing just stops",
    "// coming back.",
    body,
    CDK_STATE_END,
    "",
  ].join("\n");
}

/** The block back out of a stack · null when the file does not carry one. */
export function cdkStateFrom(source: string): Record<string, unknown> | null {
  const start = source.indexOf(CDK_STATE_BEGIN);
  const end = source.indexOf(CDK_STATE_END, start + 1);
  if (start === -1 || end === -1) return null;
  const lines = source
    .slice(start + CDK_STATE_BEGIN.length, end)
    .split("\n")
    .map((l) => l.trimStart())
    .filter((l) => l.startsWith("//"))
    .map((l) => l.slice(2).replace(/^ /, ""));
  // Everything before the opening brace is the prose above the payload.
  const from = lines.findIndex((l) => l.startsWith("{"));
  if (from === -1) return null;
  try {
    const parsed = JSON.parse(lines.slice(from).join("\n")) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
