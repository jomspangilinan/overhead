// Editing the drawing as a document · the one path the Code panel and the
// agent's patch_state both take. Addressed by id, merged not replaced, and
// refused whole when any part of it is wrong.

import { describe, expect, it } from "vitest";
import { applyPatch, describeChanges } from "../src/engine/patch";
import { DEFAULT_TRAFFIC, type StateSnapshot } from "../src/engine/model";

const base = (): StateSnapshot => ({
  nodes: [
    {
      id: "api",
      service: "apigateway",
      name: "api",
      settings: { apiType: "HTTP", requestsPerMonth: 5_000_000 },
      position: { x: 0, y: 0 },
    },
    {
      id: "fn",
      service: "lambda",
      name: "fn",
      settings: { architecture: "arm64", memoryMb: 512, avgDurationMs: 120 },
      position: { x: 240, y: 0 },
    },
  ],
  edges: [{ id: "e1", from: "api", to: "fn", kind: "sync" }],
  containers: [{ id: "region", kind: "region", name: "ap-southeast-1", collapsed: false }],
  sections: [],
  traffic: DEFAULT_TRAFFIC,
});

const ok = (r: ReturnType<typeof applyPatch>) => {
  if (!r.ok) throw new Error(`patch failed: ${r.code} ${r.message}`);
  return r;
};

describe("merging by id", () => {
  it("changes one setting and leaves the others alone", () => {
    const r = ok(applyPatch(base(), { nodes: [{ id: "fn", settings: { memoryMb: 1024 } }] }));
    const fn = r.snapshot.nodes.find((n) => n.id === "fn")!;
    expect(fn.settings).toEqual({ architecture: "arm64", memoryMb: 1024, avgDurationMs: 120 });
    expect(r.changes).toEqual([{ kind: "changed", type: "resource", id: "fn", fields: ["settings"] }]);
  });

  it("merges a position one level deep, so x alone keeps y", () => {
    const r = ok(applyPatch(base(), { nodes: [{ id: "fn", position: { x: 900 } }] }));
    expect(r.snapshot.nodes.find((n) => n.id === "fn")!.position).toEqual({ x: 900, y: 0 });
  });

  it("reports nothing when the patch restates what is already true", () => {
    const r = ok(applyPatch(base(), { nodes: [{ id: "fn", name: "fn" }] }));
    expect(r.changes).toEqual([]);
    expect(describeChanges(r.changes)).toBe("nothing changed");
  });

  it("an unknown id creates, with the service's defaults filled in", () => {
    const r = ok(
      applyPatch(base(), { nodes: [{ id: "db", service: "dynamodb", name: "orders" }] }),
    );
    const db = r.snapshot.nodes.find((n) => n.id === "db")!;
    expect(db.name).toBe("orders");
    expect(Object.keys(db.settings).length).toBeGreaterThan(0);
    expect(r.changes[0].kind).toBe("added");
  });

  it("adds a connection between two resources", () => {
    const r = ok(applyPatch(base(), { edges: [{ from: "fn", to: "api", kind: "async" }] }));
    expect(r.snapshot.edges).toHaveLength(2);
    expect(r.snapshot.edges[1]).toMatchObject({ from: "fn", to: "api", kind: "async" });
  });

  it("changes a connection's kind without touching its ends", () => {
    const r = ok(applyPatch(base(), { edges: [{ id: "e1", kind: "async" }] }));
    expect(r.snapshot.edges[0]).toMatchObject({ from: "api", to: "fn", kind: "async" });
  });

  it("removes by id, taking the connections that touched it", () => {
    const r = ok(applyPatch(base(), { remove: ["fn"] }));
    expect(r.snapshot.nodes.map((n) => n.id)).toEqual(["api"]);
    expect(r.snapshot.edges).toEqual([]);
    expect(r.changes).toEqual([{ kind: "removed", type: "resource", id: "fn", fields: [] }]);
  });

  it("removes a connection by its own id", () => {
    const r = ok(applyPatch(base(), { remove: ["e1"] }));
    expect(r.snapshot.nodes).toHaveLength(2);
    expect(r.snapshot.edges).toEqual([]);
  });

  it("merges traffic", () => {
    const r = ok(applyPatch(base(), { traffic: { requestsPerMonth: 9_000_000 } }));
    expect(r.snapshot.traffic.requestsPerMonth).toBe(9_000_000);
    expect(r.snapshot.traffic.avgPayloadKb).toBe(DEFAULT_TRAFFIC.avgPayloadKb);
  });
});

describe("what it refuses, and what it says", () => {
  it("an invalid setting value · names the field and the allowed values", () => {
    const r = applyPatch(base(), { nodes: [{ id: "fn", settings: { architecture: "risc-v" } }] });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("invalid_value");
      expect(r.at).toBe("nodes[fn].settings.architecture");
      expect(r.allowed).toContain("arm64");
    }
  });

  it("a setting the service does not have", () => {
    const r = applyPatch(base(), { nodes: [{ id: "fn", settings: { colour: "blue" } }] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("invalid_setting");
  });

  it("a new resource with no service", () => {
    const r = applyPatch(base(), { nodes: [{ id: "x", name: "mystery" }] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("no_such_service");
  });

  it("a connection to nothing", () => {
    const r = applyPatch(base(), { edges: [{ from: "fn", to: "ghost" }] });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("no_such_node");
      expect(r.at).toBe("edges[new].to");
    }
  });

  it("a frame inside itself", () => {
    const r = applyPatch(base(), { containers: [{ id: "region", parent: "region" }] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("would_cycle");
  });

  it("removing something that is not here", () => {
    const r = applyPatch(base(), { remove: ["ghost"] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("no_such_node");
  });

  it("nothing is applied when any part of the patch is wrong", () => {
    const before = base();
    const r = applyPatch(before, {
      nodes: [
        { id: "fn", settings: { memoryMb: 1024 } },
        { id: "api", settings: { apiType: "carrier-pigeon" } },
      ],
    });
    expect(r.ok).toBe(false);
    // the good half did not land: the caller still holds the old drawing
    expect(before.nodes.find((n) => n.id === "fn")!.settings.memoryMb).toBe(512);
  });
});

describe("a whole document, applied to an empty drawing", () => {
  it("is the Code panel's path: everything validated, nothing lost", () => {
    const doc = base();
    const r = ok(
      applyPatch(
        { nodes: [], edges: [], containers: [], sections: [], traffic: DEFAULT_TRAFFIC },
        {
          nodes: doc.nodes as unknown as Record<string, unknown>[],
          containers: doc.containers as unknown as Record<string, unknown>[],
          edges: doc.edges as unknown as Record<string, unknown>[],
          traffic: doc.traffic,
        },
      ),
    );
    expect(r.snapshot.nodes.map((n) => n.id)).toEqual(["api", "fn"]);
    expect(r.snapshot.nodes.map((n) => n.position)).toEqual([
      { x: 0, y: 0 },
      { x: 240, y: 0 },
    ]);
    expect(r.snapshot.edges[0]).toMatchObject({ id: "e1", from: "api", to: "fn" });
    expect(r.snapshot.containers).toEqual(doc.containers);
  });
});
