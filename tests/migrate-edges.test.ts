import { describe, expect, it } from "vitest";
import { migrateEdge, migrateSnapshot } from "../src/engine/migrate";
import { arrowModeOf, dashOf } from "../src/engine/model";

describe("edge migration", () => {
  it("a single route point becomes one waypoint", () => {
    const e = migrateEdge({ id: "e", from: "a", to: "b", kind: "sync", route: { x: 10, y: 20 } });
    expect(e.waypoints).toEqual([{ x: 10, y: 20 }]);
    expect("route" in e).toBe(false);
  });

  it("boolean arrow flags become modes", () => {
    expect(migrateEdge({ id: "e", from: "a", to: "b", kind: "sync", style: { arrow: true } }).style?.arrow).toBe("end");
    expect(migrateEdge({ id: "e", from: "a", to: "b", kind: "sync", style: { arrow: false } }).style?.arrow).toBe("none");
  });

  it("style never leaks into kind — a dashed request stays a request", () => {
    const e = migrateEdge({ id: "e", from: "a", to: "b", kind: "sync", style: { dash: "dashed" } });
    expect(e.kind).toBe("sync");
    expect(dashOf(e)).toBe("dashed");
    expect(arrowModeOf(e)).toBe("end");
  });

  it("is idempotent on the current shape and drops empties", () => {
    const cur = { id: "e", from: "a", to: "b", kind: "data" as const, waypoints: [{ x: 1, y: 2 }], style: { width: 2 } };
    expect(migrateEdge(cur)).toEqual(cur);
    const empty = migrateEdge({ id: "e", from: "a", to: "b", kind: "data", style: {}, waypoints: [] });
    expect("style" in empty).toBe(false);
    expect("waypoints" in empty).toBe(false);
  });

  it("runs inside migrateSnapshot", () => {
    const snap = migrateSnapshot({ nodes: [], edges: [{ id: "e", from: "a", to: "b", kind: "async", route: { x: 3, y: 4 } }], containers: [], sections: [] });
    expect(snap.edges[0].waypoints).toEqual([{ x: 3, y: 4 }]);
  });
});
