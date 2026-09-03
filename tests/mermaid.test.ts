// Mermaid both ways · the fourth format, and the only one that starts life
// as somebody else's picture.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { exportMermaid } from "../src/engine/exporters/mermaid";
import { importMermaid, applyMermaid, serviceFromLabel, looksLikeMermaid } from "../src/engine/iac/mermaid";
import { detectFormat, importAny } from "../src/engine/iac/import";
import { migrateSnapshot } from "../src/engine/migrate";
import { DEFAULT_TRAFFIC, type StateSnapshot } from "../src/engine/model";
import type { PricingTable } from "../src/engine/pricing";
import { getService } from "../src/engine/services";
import { defaultSettings } from "../src/engine/defineService";

const pricing = JSON.parse(
  readFileSync(join(__dirname, "..", "data", "pricing.us-east-1.json"), "utf8"),
) as PricingTable;

function node(id: string, service: string, name: string, container?: string) {
  const def = getService(service)!;
  return {
    id,
    service: def.id,
    name,
    settings: defaultSettings(def),
    position: { x: 0, y: 0 },
    ...(container ? { container } : {}),
  };
}

const drawing: StateSnapshot = migrateSnapshot({
  nodes: [
    node("api", "apigateway", "orders-api", "region-1"),
    node("fn", "lambda", "worker", "region-1"),
    node("orders", "dynamodb", "orders", "region-1"),
    node("approve", "decision", "approved?"),
  ],
  edges: [
    { id: "e1", from: "api", to: "fn", kind: "sync", volumePerMonth: 5_000_000 },
    { id: "e2", from: "fn", to: "orders", kind: "data", label: "writes" },
    { id: "e3", from: "fn", to: "approve", kind: "async" },
  ],
  containers: [
    { id: "cloud-1", kind: "cloud", name: "AWS Cloud", collapsed: false },
    { id: "region-1", kind: "region", name: "ap-southeast-1", parent: "cloud-1", collapsed: false },
  ],
  sections: [{ id: "s1", name: "Ingest", color: "#6FE3B0", nodeIds: ["api", "fn"], collapsed: false }],
  traffic: DEFAULT_TRAFFIC,
});

describe("mermaid export", () => {
  it("writes a flowchart with nested subgraphs and the three edge encodings", () => {
    const out = exportMermaid(drawing, pricing);
    expect(out).toMatch(/^flowchart LR/);
    expect(out).toContain('subgraph g_cloud-1["AWS Cloud"]');
    expect(out).toContain('subgraph g_region-1["ap-southeast-1"]');
    expect(out).toContain("api -->");
    expect(out).toContain("fn ---|\"writes\"| orders");
    expect(out).toContain("fn -.-> approve");
    // With icons off · the bracket is what a flow shape falls back to, and
    // it is what the Mermaid tab shows.
    const plain = exportMermaid(drawing, pricing, { icons: false });
    expect(plain).toMatch(/approve\{"approved\?"\}/);
  });

  it("carries the price in the label, and can be asked not to", () => {
    // Two label forms, because an image node's label is not a place every
    // renderer honours HTML: `name · $x/mo` there, `name<br/>$x/mo` in a
    // bracket node. Both are stripped back off on the way in.
    expect(exportMermaid(drawing, pricing)).toMatch(/orders-api · \$\d/);
    expect(exportMermaid(drawing, pricing, { icons: false })).toMatch(/orders-api<br\/>\$\d/);
    expect(exportMermaid(drawing, pricing, { cost: false })).not.toMatch(/\$\d+\.\d\d\/mo/);
    // A flow shape has no price, so it never carries a figure either way.
    expect(exportMermaid(drawing, pricing)).not.toMatch(/approved\?<br/);
  });
});

describe("icons travel with the document", () => {
  it("writes every node as an image node · AWS linked, flow shapes inline", () => {
    const out = exportMermaid(drawing, pricing);
    expect(out).toContain('img: "https://overhead-ecru.vercel.app/icons/aws/Arch_AWS-Lambda_64.svg"');
    expect(out).toContain('label: "worker · $');
    // The square is the point of constraint: on · without it the image
    // stretches to whatever width the label needs.
    expect(out).toContain('constraint: "on"');
    // A flow shape is a link too · one format in the document, not two.
    expect(out).toContain('img: "https://overhead-ecru.vercel.app/icons/flow/decision.svg"');
    expect(out).not.toContain("data:image/svg");
    expect(out).not.toMatch(/approve\{"/);
  });

  it("can be asked for the plain form, which is what the live tab uses", () => {
    const out = exportMermaid(drawing, pricing, { icons: false, cost: false });
    expect(out).not.toContain("img:");
    expect(out).toContain('fn["worker"]');
  });

  it("reads an image node back, label and service", () => {
    const doc = exportMermaid(drawing, pricing);
    const result = importMermaid(doc);
    if (!result.ok) throw new Error(result.message);
    const fn = result.snapshot.nodes.find((n) => n.id === "fn")!;
    expect(fn.service).toBe("lambda");
    // The costed suffix is not part of the name, in either label form.
    expect(fn.name).toBe("worker");
  });

  it("names the service from the icon URL when the metadata line is gone", () => {
    const doc = exportMermaid(drawing, pricing)
      .split("\n")
      .filter((l) => !l.startsWith("%% overhead:"))
      .join("\n");
    const result = importMermaid(doc);
    if (!result.ok) throw new Error(result.message);
    // "orders-api" names no service and the shape says nothing · the icon does.
    expect(result.snapshot.nodes.find((n) => n.id === "api")!.service).toBe("apigateway");
    // And a flow shape's file names it too, so a decision does not come
    // back as a plain step.
    expect(result.snapshot.nodes.find((n) => n.id === "approve")!.service).toBe("decision");
  });
});

describe("mermaid round trip", () => {
  it("comes back as the same drawing", () => {
    const doc = exportMermaid(drawing, pricing);
    const result = importMermaid(doc);
    if (!result.ok) throw new Error(result.message);
    const back = result.snapshot;
    // Document order groups by subgraph, so compare by id rather than by
    // position in the list.
    const shape = (s: StateSnapshot) =>
      Object.fromEntries(s.nodes.map((n) => [n.id, [n.service, n.name]]));
    expect(shape(back)).toEqual(shape(drawing));
    expect(back.nodes.find((n) => n.id === "fn")!.container).toBe("region-1");
    expect(back.containers.map((c) => [c.id, c.kind, c.parent])).toEqual([
      ["cloud-1", "cloud", undefined],
      ["region-1", "region", "cloud-1"],
    ]);
    expect(back.edges.map((e) => [e.from, e.to, e.kind])).toEqual([
      ["api", "fn", "sync"],
      ["fn", "orders", "data"],
      ["fn", "approve", "async"],
    ]);
    expect(back.edges.find((e) => e.to === "orders")!.label).toBe("writes");
    expect(back.sections.map((s) => [s.name, s.nodeIds])).toEqual([["Ingest", ["api", "fn"]]]);
  });

  it("is detected as mermaid, not as anything else", () => {
    expect(detectFormat(exportMermaid(drawing, pricing))).toBe("mermaid");
    expect(looksLikeMermaid("graph TD\n  a --> b")).toBe(true);
    expect(looksLikeMermaid('{"nodes":[]}')).toBe(false);
    const any = importAny(exportMermaid(drawing, pricing));
    expect(any.ok && any.format).toBe("mermaid");
  });
});

describe("somebody else's flowchart", () => {
  const hand = `flowchart LR
  user((Customer)) --> api[HTTP API]
  api --> fn[Lambda worker]
  fn -.-> q[SQS queue]
  fn --- db[(DynamoDB orders)]
  q --> notify[Send email]
  notify --> ok{Delivered?}
  subgraph orders-vpc[Orders VPC]
    fn
  end
`;

  it("prices what it recognises and keeps the rest as shapes", () => {
    const result = importMermaid(hand);
    if (!result.ok) throw new Error(result.message);
    const byId = Object.fromEntries(result.snapshot.nodes.map((n) => [n.id, n.service]));
    expect(byId.api).toBe("apigateway");
    expect(byId.fn).toBe("lambda");
    expect(byId.q).toBe("sqs");
    expect(byId.db).toBe("dynamodb");
    // Nothing in the vocabulary · the bracket decides.
    expect(byId.user).toBe("actor");
    expect(byId.notify).toBe("step");
    expect(byId.ok).toBe("decision");
  });

  it("reads a subgraph that names a container kind as that container", () => {
    const result = importMermaid(hand);
    if (!result.ok) throw new Error(result.message);
    expect(result.snapshot.containers.map((c) => [c.kind, c.name])).toEqual([["vpc", "Orders VPC"]]);
    expect(result.snapshot.nodes.find((n) => n.id === "fn")!.container).toBe("orders-vpc");
  });

  it("reads a subgraph that names nothing as a section", () => {
    const result = importMermaid("flowchart LR\n subgraph Nightly job\n  a[Step one]\n  b[Step two]\n end\n a --> b\n");
    if (!result.ok) throw new Error(result.message);
    expect(result.snapshot.containers).toHaveLength(0);
    expect(result.snapshot.sections.map((s) => [s.name, s.nodeIds])).toEqual([
      ["Nightly job", ["a", "b"]],
    ]);
  });

  it("reads chains, inline labels and no-space connectors", () => {
    const result = importMermaid("flowchart TD\n a-->b-- writes -->c\n c -.->|retry| a\n");
    if (!result.ok) throw new Error(result.message);
    expect(result.snapshot.edges.map((e) => [e.from, e.to, e.kind, e.label])).toEqual([
      ["a", "b", "sync", undefined],
      ["b", "c", "sync", "writes"],
      ["c", "a", "async", "retry"],
    ]);
  });

  it("refuses what is not a flowchart, with the reason", () => {
    const bad = importMermaid("digraph { a -> b }");
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.message).toContain("flowchart");
  });

  it("matches a service by label only where the label says so", () => {
    expect(serviceFromLabel("Lambda worker")).toBe("lambda");
    expect(serviceFromLabel("HTTP API")).toBe("apigateway");
    expect(serviceFromLabel("thumbnail queue")).toBe("sqs");
    expect(serviceFromLabel("billing team approves")).toBe(null);
  });
});

describe("the live editor", () => {
  it("keeps positions, settings and edge detail an edit did not mention", () => {
    const placed: StateSnapshot = {
      ...drawing,
      nodes: drawing.nodes.map((n, i) => ({
        ...n,
        position: { x: 100 + i * 300, y: 220 },
        ...(n.id === "fn" ? { settings: { ...n.settings, memoryMb: 1024 } } : {}),
      })),
    };
    const edited = exportMermaid(placed, pricing, { cost: false }).replace("worker", "renamed");
    const incoming = importMermaid(edited);
    if (!incoming.ok) throw new Error(incoming.message);
    const next = applyMermaid(placed, incoming.snapshot);

    const fn = next.nodes.find((n) => n.id === "fn")!;
    expect(fn.name).toBe("renamed");
    expect(fn.position).toEqual({ x: 400, y: 220 });
    expect(fn.settings.memoryMb).toBe(1024);
    // An edge the text restated keeps the volume the text cannot carry.
    expect(next.edges.find((e) => e.from === "api")!.volumePerMonth).toBe(5_000_000);
    expect(next.traffic).toEqual(placed.traffic);
  });

  it("does not demote a node whose label names no service", () => {
    // "worker" is a Lambda on the canvas and nothing in the text says so ·
    // the shape is a fallback for a node being created, never a statement
    // about one that already exists.
    const doc = 'flowchart LR\n  api["orders-api"] --> fn["worker"]\n';
    const incoming = importMermaid(doc);
    if (!incoming.ok) throw new Error(incoming.message);
    expect(incoming.snapshot.nodes.find((n) => n.id === "fn")!.service).toBe("step");
    const next = applyMermaid(drawing, incoming.snapshot, incoming.statedServices);
    expect(next.nodes.find((n) => n.id === "fn")!.service).toBe("lambda");
    // A label that does name one is still a real edit.
    const said = importMermaid('flowchart LR\n  fn["SQS queue"]\n');
    if (!said.ok) throw new Error(said.message);
    expect(applyMermaid(drawing, said.snapshot, said.statedServices).nodes[0].service).toBe("sqs");
  });

  it("removes what the document no longer says, and places what it adds", () => {
    const doc = `flowchart LR
  api["orders-api"] --> fn["worker"]
  fn --> fresh["new step"]
%% overhead: {"services":{"api":"apigateway","fn":"lambda"},"containers":{},"sections":[],"ids":{}}
`;
    const placed: StateSnapshot = {
      ...drawing,
      nodes: drawing.nodes.map((n, i) => ({ ...n, position: { x: 100 + i * 300, y: 220 } })),
    };
    const incoming = importMermaid(doc);
    if (!incoming.ok) throw new Error(incoming.message);
    const next = applyMermaid(placed, incoming.snapshot);
    expect(next.nodes.map((n) => n.id)).toEqual(["api", "fn", "fresh"]);
    // The new one lands clear of the drawing, not on top of it.
    const fresh = next.nodes.find((n) => n.id === "fresh")!;
    expect(fresh.position.x).toBeGreaterThan(400);
    expect(next.edges.map((e) => [e.from, e.to])).toEqual([
      ["api", "fn"],
      ["fn", "fresh"],
    ]);
  });
});
