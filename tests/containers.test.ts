// Containers nest, roll cost up and collapse; they are never validated
// beyond "no cycles, nothing dangling". Sections are the same without the
// AWS meaning.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  TYPICAL_PARENTS,
  CONTAINER_KINDS,
  ancestorsOf,
  breadcrumb,
  containerStats,
  descendantIds,
  nodesUnder,
  outermostCollapsedAncestor,
  wouldCycle,
  type Container,
} from "../src/engine/containers";
import { migrateSnapshot } from "../src/engine/migrate";
import type { ArchNode, StateSnapshot } from "../src/engine/model";
import { DEFAULT_TRAFFIC } from "../src/engine/model";
import type { PricingTable } from "../src/engine/pricing";

const pricing = JSON.parse(
  readFileSync(join(__dirname, "..", "data", "pricing.us-east-1.json"), "utf8"),
) as PricingTable;

const tree: Container[] = [
  { id: "cloud", kind: "cloud", name: "AWS Cloud", collapsed: false },
  { id: "region", kind: "region", name: "ap-southeast-1", parent: "cloud", collapsed: false },
  { id: "vpc", kind: "vpc", name: "prod-vpc", parent: "region", collapsed: false },
  { id: "priv", kind: "subnetpri", name: "private-a", parent: "vpc", collapsed: false },
];

function node(id: string, service: string, container?: string): ArchNode {
  return {
    id,
    service: service as ArchNode["service"],
    name: id,
    settings: {},
    container,
    position: { x: 0, y: 0 },
  };
}

function snap(nodes: ArchNode[], containers = tree): StateSnapshot {
  return {
    nodes,
    edges: [],
    containers,
    sections: [],
    traffic: { ...DEFAULT_TRAFFIC },
  };
}

describe("container placement", () => {
  it("has a typical parent hint for every kind, and every hint is a real kind", () => {
    for (const kind of CONTAINER_KINDS) {
      expect(Array.isArray(TYPICAL_PARENTS[kind])).toBe(true);
      for (const p of TYPICAL_PARENTS[kind]) expect(CONTAINER_KINDS).toContain(p);
    }
    expect(TYPICAL_PARENTS.cloud).toEqual([]);
    expect(TYPICAL_PARENTS.vpc).toContain("region");
  });

  it("refuses a cycle", () => {
    expect(wouldCycle(tree, "region", "priv")).toBe(true);
    expect(wouldCycle(tree, "region", "cloud")).toBe(false);
    expect(wouldCycle(tree, "vpc", "vpc")).toBe(true);
  });
});

describe("container tree", () => {
  it("walks ancestors and descendants at depth", () => {
    expect(ancestorsOf(tree, "priv").map((c) => c.id)).toEqual([
      "vpc",
      "region",
      "cloud",
    ]);
    expect(descendantIds(tree, "cloud").sort()).toEqual(["priv", "region", "vpc"]);
  });

  it("returns the placement breadcrumb", () => {
    const s = snap([node("fn", "lambda", "priv")]);
    expect(breadcrumb(s, "fn")).toEqual([
      "AWS Cloud",
      "ap-southeast-1",
      "prod-vpc",
      "private-a",
    ]);
  });

  it("collects nodes recursively", () => {
    const s = snap([
      node("fn", "lambda", "priv"),
      node("table", "dynamodb", "region"),
      node("loose", "s3"),
    ]);
    expect(nodesUnder(s, "cloud").map((n) => n.id).sort()).toEqual(["fn", "table"]);
    expect(nodesUnder(s, "priv").map((n) => n.id)).toEqual(["fn"]);
  });

  it("rolls cost up the tree — subnet → VPC → region → cloud", () => {
    const s = snap([
      node("fn", "lambda", "priv"),
      node("table", "dynamodb", "region"),
    ]);
    const stats = containerStats(s, pricing);
    expect(stats.get("priv")!.resources).toBe(1);
    expect(stats.get("vpc")!.resources).toBe(1);
    expect(stats.get("region")!.resources).toBe(2);
    expect(stats.get("cloud")!.resources).toBe(2);
    // the cloud total is the sum of everything beneath it
    expect(stats.get("cloud")!.monthly).toBeCloseTo(
      stats.get("region")!.monthly,
      2,
    );
    expect(stats.get("cloud")!.monthly).toBeGreaterThan(stats.get("priv")!.monthly);
  });

  it("collapsing an outer container wins over an inner one", () => {
    const collapsedBoth = tree.map((c) =>
      c.id === "vpc" || c.id === "priv" ? { ...c, collapsed: true } : c,
    );
    expect(outermostCollapsedAncestor(collapsedBoth, "priv")).toBe("vpc");
    expect(outermostCollapsedAncestor(tree, "priv")).toBeNull();
  });
});

describe("migration from the previous shape", () => {
  it("maps groups to containers, dissolves az, and turns logical into a section", () => {
    const v1 = {
      nodes: [
        { id: "a", service: "lambda", name: "a", settings: {}, lane: "handlers", group: "az1", position: { x: 0, y: 0 } },
        { id: "b", service: "s3", name: "b", settings: {}, group: "log1", position: { x: 0, y: 0 } },
      ],
      edges: [],
      groups: [
        { id: "c1", kind: "cloud", name: "AWS Cloud" },
        { id: "vpc1", kind: "vpc", name: "prod", parent: "c1" },
        { id: "az1", kind: "az", name: "az-a", parent: "vpc1" },
        { id: "log1", kind: "logical", name: "Checkout flow" },
      ],
      traffic: { ...DEFAULT_TRAFFIC },
    };
    const out = migrateSnapshot(v1);

    // az dissolved; its member re-parented to the AZ's own parent
    expect(out.containers.map((c) => c.id).sort()).toEqual(["c1", "vpc1"]);
    expect(out.nodes.find((n) => n.id === "a")!.container).toBe("vpc1");

    // logical became a section carrying its members
    expect(out.sections).toHaveLength(1);
    expect(out.sections[0].name).toBe("Checkout flow");
    expect(out.sections[0].nodeIds).toEqual(["b"]);

    // lane and group are gone from the model
    expect("lane" in out.nodes[0]).toBe(false);
    expect("group" in out.nodes[0]).toBe(false);
  });

  it("keeps any nesting the user drew, and only cuts a cycle or a dangling parent", () => {
    const out = migrateSnapshot({
      nodes: [],
      edges: [],
      containers: [
        { id: "c1", kind: "cloud", name: "AWS Cloud", collapsed: false },
        // a subnet directly in the cloud is fine · the user meant it
        { id: "s1", kind: "subnetpub", name: "public-a", parent: "c1", collapsed: false },
        { id: "v1", kind: "vpc", name: "vpc", parent: "gone", collapsed: false },
        { id: "a", kind: "region", name: "a", parent: "b", collapsed: false },
        { id: "b", kind: "region", name: "b", parent: "a", collapsed: false },
      ],
      sections: [],
      traffic: { ...DEFAULT_TRAFFIC },
    });
    const by = (id: string) => out.containers.find((c) => c.id === id)!;
    expect(by("s1").parent).toBe("c1");
    expect(by("v1").parent).toBeUndefined();
    expect(by("a").parent === undefined || by("b").parent === undefined).toBe(true);
  });

  it("is a no-op on an already-migrated snapshot", () => {
    const v2 = snap([node("fn", "lambda", "priv")]);
    const out = migrateSnapshot(structuredClone(v2));
    expect(out.containers).toEqual(v2.containers);
    expect(out.nodes[0].container).toBe("priv");
  });
});
