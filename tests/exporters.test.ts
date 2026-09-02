// One test per exporter, plus the JSON round-trip guarantee.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  exportJson,
  exportMarkdown,
  exportMermaid,
  exportCdk,
  chunkCount,
  chunkOf,
  CHUNK_SIZE,
} from "../src/engine/exporters";
import { monthlyTotal } from "../src/engine/cost";
import type { StateSnapshot } from "../src/engine/model";
import type { PricingTable } from "../src/engine/pricing";

const pricing = JSON.parse(
  readFileSync(join(__dirname, "..", "data", "pricing.us-east-1.json"), "utf8"),
) as PricingTable;

const samples: Record<string, StateSnapshot> = Object.fromEntries(
  ["api-backend", "media-pipeline", "event-driven"].map((n) => [
    n,
    JSON.parse(readFileSync(join(__dirname, "..", "samples", `${n}.json`), "utf8")),
  ]),
);
const base = samples["api-backend"];

describe("exporters", () => {
  it("json round-trips: parse → same model → same total", () => {
    const parsed = JSON.parse(exportJson(base, pricing)) as StateSnapshot;
    expect(parsed.nodes).toEqual(base.nodes);
    expect(parsed.edges).toEqual(base.edges);
    expect(parsed.traffic).toEqual(base.traffic);
    expect(monthlyTotal(parsed, pricing)).toBe(monthlyTotal(base, pricing));
  });

  it("markdown carries total, per-node costs, findings and the mermaid block", () => {
    const md = exportMarkdown(base, pricing);
    expect(md).toContain("Monthly estimate: $");
    for (const n of base.nodes) expect(md).toContain(`| ${n.name} |`);
    expect(md).toContain("```mermaid");
    expect(md).toContain(pricing.region);
  });

  it("mermaid encodes the three edge kinds distinctly", () => {
    const mm = exportMermaid(samples["media-pipeline"], pricing);
    expect(mm).toMatch(/^flowchart LR/);
    expect(mm).toMatch(/-\.->/); // async: dotted with arrowhead
    expect(mm).toMatch(/ ---[|\s]/); // data: open link, no arrowhead
    for (const n of samples["media-pipeline"].nodes) {
      expect(mm).toContain(n.name);
    }
  });

  it("cdk emits one construct per node with the assumptions header", () => {
    for (const snap of Object.values(samples)) {
      const ts = exportCdk(snap, pricing);
      expect(ts).toContain("Assumptions and stubs");
      expect(ts).toContain("export class OverheadStack extends cdk.Stack");
      for (const n of snap.nodes) expect(ts).toContain(n.name);
    }
  });

  it("chunking reassembles exactly", () => {
    const content = exportCdk(samples["event-driven"], pricing);
    const n = chunkCount(content);
    expect(n).toBe(Math.ceil(content.length / CHUNK_SIZE));
    let joined = "";
    for (let i = 0; i < n; i++) joined += chunkOf(content, i);
    expect(joined).toBe(content);
  });
});
