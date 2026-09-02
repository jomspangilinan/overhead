// One door for everything that arrives as a file.
//
// Two formats read back into a drawing, and they are told apart by what is
// inside them rather than by the extension · both are commonly `.json`, and
// a file called `stack.json` is as likely to be a template as a saved
// drawing. Whichever it is, the result has the same shape, so the same
// reconciliation (replace / merge) applies to both.

import type { StateSnapshot } from "../model";
import { DEFAULT_TRAFFIC } from "../model";
import { migrateSnapshot } from "../migrate";
import { getService } from "../services";
import { importCloudFormation, type ImportResult } from "./cloudformation";

export type ImportFormat = "cloudformation" | "overhead";

/** What this text is, from its content · null when it is neither. */
export function detectFormat(raw: string): ImportFormat | null {
  const text = raw.trim();
  if (!text) return null;
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
  if (opts.format && detected && detected !== opts.format) {
    return {
      ok: false,
      code: "not_a_template",
      message:
        detected === "overhead"
          ? "This is an Overhead file, not a CloudFormation template · pick Overhead file on the left."
          : "This is a CloudFormation template, not an Overhead file · pick CloudFormation on the left.",
    };
  }
  const result = format === "overhead" ? importOverheadState(raw) : importCloudFormation(raw, opts);
  return { ...result, format };
}
