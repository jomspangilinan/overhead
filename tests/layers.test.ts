import { describe, expect, it } from "vitest";
import { layerRows, sectionMembersDeep } from "../src/engine/layers";
import type { StateSnapshot } from "../src/engine/model";

const node = (id: string, container?: string) => ({ id, service: "lambda" as const, name: id, settings: {}, container, position: { x: 0, y: 0 } });
const snap = (over: Partial<StateSnapshot> = {}): StateSnapshot => ({
  nodes: [],
  edges: [],
  containers: [],
  sections: [],
  traffic: { requestsPerMonth: 1, avgPayloadKb: 1 },
  ...over,
});

describe("layer rows", () => {
  it("a section spanning two containers appears under each, with only the members held there", () => {
    const s = snap({
      containers: [
        { id: "vpc", kind: "vpc", name: "vpc", collapsed: false },
        { id: "reg", kind: "region", name: "reg", collapsed: false },
      ],
      nodes: [node("a", "vpc"), node("b", "reg"), node("c", "reg")],
      sections: [{ id: "s1", name: "Payments", color: "#f00", nodeIds: ["a", "b"], collapsed: false }],
    });
    const rows = layerRows(s, new Set());
    const sectionRows = rows.filter((r) => r.kind === "section");
    expect(sectionRows).toHaveLength(2);
    const underVpc = rows.findIndex((r) => r.kind === "section" && r.key.includes("vpc"));
    expect(rows[underVpc + 1]).toMatchObject({ kind: "node", id: "a" });
    // c is in no section: a bare row under reg, b is not duplicated as bare
    const bare = rows.filter((r) => r.kind === "node" && !r.key.includes("s1")).map((r) => r.id);
    expect(bare).toEqual(["c"]);
  });

  it("every row carries the frame and section that hold it, so a drop beside it can adopt them", () => {
    const s = snap({
      containers: [{ id: "vpc", kind: "vpc", name: "vpc", collapsed: false }],
      nodes: [node("a", "vpc"), node("b")],
      sections: [{ id: "s1", name: "Payments", color: "#f00", nodeIds: ["a"], collapsed: false }],
    });
    const rows = layerRows(s, new Set());
    const ctxOf = (kind: string, id: string) => rows.find((r) => r.kind === kind && r.id === id)!.ctx;
    // the frame itself sits at the top level; the section sits in the frame
    expect(ctxOf("container", "vpc")).toEqual({ container: undefined });
    expect(ctxOf("section", "s1")).toEqual({ container: "vpc" });
    // a member of the section carries both; a loose node carries neither
    expect(ctxOf("node", "a")).toEqual({ container: "vpc", section: "s1" });
    expect(ctxOf("node", "b")).toEqual({ container: undefined });
  });

  it("a memberless section is still an object at the top level", () => {
    const rows = layerRows(snap({ sections: [{ id: "s", name: "Empty", color: "#000", nodeIds: [], collapsed: false }] }), new Set());
    expect(rows).toEqual([expect.objectContaining({ kind: "section", id: "s", depth: 0 })]);
  });

  it("groups are folders that nest under a parent section", () => {
    const s = snap({
      nodes: [node("a"), node("b")],
      sections: [
        { id: "p", name: "Parent", color: "#000", nodeIds: ["a"], collapsed: false },
        { id: "g", name: "Grp", color: "#000", kind: "group", parentId: "p", nodeIds: ["b"], collapsed: false },
      ],
    });
    const rows = layerRows(s, new Set());
    expect(rows.map((r) => `${r.kind}:${r.id}@${r.depth}`)).toEqual(["section:p@0", "group:g@1", "node:b@2", "node:a@1"]);
    expect(sectionMembersDeep(s.sections, "p").sort()).toEqual(["a", "b"]);
  });

  it("folding hides children and connections close the list", () => {
    const s = snap({
      containers: [{ id: "c", kind: "cloud", name: "c", collapsed: false }],
      nodes: [node("a", "c"), node("b", "c")],
      edges: [{ id: "e", from: "a", to: "b", kind: "sync" }],
    });
    const open = layerRows(s, new Set());
    expect(open.map((r) => r.kind)).toEqual(["container", "node", "node", "connections", "edge"]);
    const folded = layerRows(s, new Set(["/c", "/connections"]));
    expect(folded.map((r) => r.kind)).toEqual(["container", "connections"]);
  });
});
