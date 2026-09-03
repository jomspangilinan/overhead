// Deleting a selection: everything selected goes, in one operation, and the
// repairs around it are consistent. Delete used to read the primary
// selection alone, so a marquee over five nodes removed one of them.

import { describe, expect, it } from "vitest";
import { removeObjects } from "../src/engine/remove";
import { DEFAULT_TRAFFIC, type StateSnapshot } from "../src/engine/model";

const snap = (): StateSnapshot => ({
  nodes: [
    { id: "api", service: "apigateway", name: "api", settings: {}, position: { x: 0, y: 0 }, container: "pri" },
    { id: "fn", service: "lambda", name: "fn", settings: {}, position: { x: 200, y: 0 }, container: "pri" },
    { id: "db", service: "dynamodb", name: "db", settings: {}, position: { x: 400, y: 0 }, container: "region" },
  ],
  edges: [
    { id: "e1", from: "api", to: "fn", kind: "sync" },
    { id: "e2", from: "fn", to: "db", kind: "data" },
  ],
  containers: [
    { id: "region", kind: "region", name: "ap-southeast-1", collapsed: false },
    { id: "vpc", kind: "vpc", name: "vpc", parent: "region", collapsed: false },
    { id: "pri", kind: "subnetpri", name: "private-a", parent: "vpc", collapsed: false },
  ],
  sections: [
    { id: "s1", name: "front", color: "#fff", nodeIds: ["api", "fn"], collapsed: false },
    { id: "s2", name: "child", color: "#fff", nodeIds: ["db"], parentId: "s1", collapsed: false },
  ],
  traffic: DEFAULT_TRAFFIC,
});

describe("removeObjects", () => {
  it("removes every selected resource at once, with the edges that touched them", () => {
    const out = removeObjects(snap(), { ids: ["api", "fn"] });
    expect(out.nodes.map((n) => n.id)).toEqual(["db"]);
    expect(out.edges).toEqual([]);
  });

  it("removes an edge selected on its own and nothing else", () => {
    const out = removeObjects(snap(), { ids: [], edgeId: "e1" });
    expect(out.nodes).toHaveLength(3);
    expect(out.edges.map((e) => e.id)).toEqual(["e2"]);
  });

  it("a section keeps the members it still has", () => {
    const out = removeObjects(snap(), { ids: ["api"] });
    expect(out.sections.find((s) => s.id === "s1")!.nodeIds).toEqual(["fn"]);
  });

  it("deleting a frame keeps what was inside it, one level up", () => {
    const out = removeObjects(snap(), { ids: ["pri"] });
    expect(out.containers.map((c) => c.id)).toEqual(["region", "vpc"]);
    expect(out.nodes.filter((n) => n.container === "vpc").map((n) => n.id)).toEqual(["api", "fn"]);
  });

  it("deleting nested frames together re-parents past all of them", () => {
    const out = removeObjects(snap(), { ids: ["vpc", "pri"] });
    expect(out.containers.map((c) => c.id)).toEqual(["region"]);
    expect(out.nodes.every((n) => n.container === "region")).toBe(true);
  });

  it("everything at once leaves an empty drawing", () => {
    const s = snap();
    const out = removeObjects(s, {
      ids: [...s.nodes.map((n) => n.id), ...s.containers.map((c) => c.id), ...s.sections.map((x) => x.id)],
    });
    expect(out.nodes).toEqual([]);
    expect(out.edges).toEqual([]);
    expect(out.containers).toEqual([]);
    expect(out.sections).toEqual([]);
    // traffic is not an object on the canvas · it survives
    expect(out.traffic).toEqual(DEFAULT_TRAFFIC);
  });

  it("a nested section whose parent goes is left at the top level, not orphaned", () => {
    const out = removeObjects(snap(), { ids: ["s1"] });
    expect(out.sections.map((x) => x.id)).toEqual(["s2"]);
    expect(out.sections[0].parentId).toBeUndefined();
  });

  it("does not touch the drawing when nothing is selected", () => {
    const s = snap();
    expect(removeObjects(s, { ids: [] })).toEqual(s);
  });
});
