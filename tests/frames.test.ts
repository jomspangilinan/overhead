// Container frames: derived from contents, floored by stored bounds, moved
// with everything inside, hit-tested for drag-and-drop re-parenting.

import { describe, expect, it } from "vitest";
import type { Container } from "../src/engine/containers";
import type { ArchNode } from "../src/engine/model";
import {
  FRAME_PAD,
  FRAME_HEAD,
  clampBounds,
  contentBoxes,
  frameBoxes,
  hitContainer,
  placeNewFrame,
  translateContainer,
} from "../src/engine/frames";

const OPTS = { nodeW: 200, nodeH: 100 };

function node(id: string, x: number, y: number, container?: string): ArchNode {
  return { id, service: "lambda", name: id, settings: {}, container, position: { x, y } };
}

const tree: Container[] = [
  { id: "cloud", kind: "cloud", name: "AWS Cloud", collapsed: false },
  { id: "region", kind: "region", name: "ap-southeast-1", parent: "cloud", collapsed: false },
  { id: "vpc", kind: "vpc", name: "prod-vpc", parent: "region", collapsed: false },
  { id: "priv", kind: "subnetpri", name: "private-a", parent: "vpc", collapsed: false },
];

describe("frameBoxes", () => {
  it("derives a frame from its members with per-kind padding and a head band", () => {
    const boxes = frameBoxes([node("a", 300, 200, "priv")], tree, OPTS);
    const priv = boxes.get("priv")!;
    expect(priv.l).toBe(300 - 100 - FRAME_PAD.subnetpri);
    expect(priv.t).toBe(200 - 50 - FRAME_PAD.subnetpri - FRAME_HEAD);
    expect(priv.r).toBe(300 + 100 + FRAME_PAD.subnetpri);
    expect(priv.b).toBe(200 + 50 + FRAME_PAD.subnetpri);
  });

  it("nests: each ancestor wraps the child frame, padded by its own kind", () => {
    const boxes = frameBoxes([node("a", 300, 200, "priv")], tree, OPTS);
    const priv = boxes.get("priv")!;
    const vpc = boxes.get("vpc")!;
    const cloud = boxes.get("cloud")!;
    expect(vpc.l).toBe(priv.l - FRAME_PAD.vpc);
    expect(vpc.b).toBe(priv.b + FRAME_PAD.vpc);
    expect(cloud.l).toBeLessThan(vpc.l);
    expect(cloud.r).toBeGreaterThan(vpc.r);
  });

  it("an empty container with no bounds has no frame; with bounds it has exactly them", () => {
    expect(frameBoxes([], tree, OPTS).has("cloud")).toBe(false);
    const withBounds: Container[] = [{ ...tree[0], bounds: { x: 10, y: 20, w: 300, h: 200 } }];
    expect(frameBoxes([], withBounds, OPTS).get("cloud")).toEqual({ l: 10, t: 20, r: 310, b: 220 });
  });

  it("stored bounds are a floor, not a clip: a member outside them grows the frame", () => {
    const pinned: Container[] = [{ id: "r", kind: "region", name: "r", collapsed: false, bounds: { x: 0, y: 0, w: 200, h: 200 } }];
    const box = frameBoxes([node("far", 900, 900, "r")], pinned, OPTS).get("r")!;
    expect(box.l).toBe(0);
    expect(box.t).toBe(0);
    expect(box.r).toBe(900 + 100 + FRAME_PAD.region);
    expect(box.b).toBe(900 + 50 + FRAME_PAD.region);
  });

  it("removing members shrinks a pinned frame back to its stored rectangle and no further", () => {
    const pinned: Container[] = [{ id: "r", kind: "region", name: "r", collapsed: false, bounds: { x: 0, y: 0, w: 200, h: 200 } }];
    expect(frameBoxes([], pinned, OPTS).get("r")).toEqual({ l: 0, t: 0, r: 200, b: 200 });
  });

  it("leaves out a node mid-drag so its old frame doesn't chase it", () => {
    const nodes = [node("a", 300, 200, "priv"), node("b", 1000, 200, "priv")];
    const all = frameBoxes(nodes, tree, OPTS).get("priv")!;
    const without = frameBoxes(nodes, tree, { ...OPTS, exclude: "b" }).get("priv")!;
    expect(all.r).toBeGreaterThan(without.r);
    expect(without.r).toBe(300 + 100 + FRAME_PAD.subnetpri);
  });
});

describe("hitContainer", () => {
  const nodes = [node("a", 300, 200, "priv"), node("b", 900, 200, "region")];
  const boxes = frameBoxes(nodes, tree, OPTS);

  it("returns the deepest frame under the point", () => {
    expect(hitContainer(boxes, tree, { x: 300, y: 200 })?.id).toBe("priv");
    expect(hitContainer(boxes, tree, { x: 900, y: 200 })?.id).toBe("region");
  });

  it("returns null on the open canvas", () => {
    expect(hitContainer(boxes, tree, { x: -5000, y: -5000 })).toBeNull();
  });

  it("honours a visibility filter (collapsed frames are not drop targets)", () => {
    const hit = hitContainer(boxes, tree, { x: 300, y: 200 }, (c) => c.id !== "priv" && c.id !== "vpc");
    expect(hit?.id).toBe("region");
  });
});

describe("translateContainer", () => {
  it("moves every node at any depth, every descendant's stored bounds, and nothing else", () => {
    const containers: Container[] = [
      { ...tree[0], bounds: { x: 0, y: 0, w: 900, h: 700 } },
      tree[1],
      { ...tree[2], bounds: { x: 100, y: 100, w: 400, h: 300 } },
      tree[3],
      { id: "other", kind: "cloud", name: "other", collapsed: false, bounds: { x: 2000, y: 0, w: 100, h: 100 } },
    ];
    const nodes = [node("deep", 300, 200, "priv"), node("mid", 700, 200, "region"), node("out", 2050, 50, "other"), node("free", 0, 0)];
    const res = translateContainer({ nodes, containers }, "cloud", 40, -10);
    const at = (id: string) => res.nodes.find((n) => n.id === id)!.position;
    expect(at("deep")).toEqual({ x: 340, y: 190 });
    expect(at("mid")).toEqual({ x: 740, y: 190 });
    expect(at("out")).toEqual({ x: 2050, y: 50 });
    expect(at("free")).toEqual({ x: 0, y: 0 });
    expect(res.containers.find((c) => c.id === "cloud")!.bounds).toEqual({ x: 40, y: -10, w: 900, h: 700 });
    expect(res.containers.find((c) => c.id === "vpc")!.bounds).toEqual({ x: 140, y: 90, w: 400, h: 300 });
    expect(res.containers.find((c) => c.id === "other")!.bounds).toEqual({ x: 2000, y: 0, w: 100, h: 100 });
  });
});

describe("translateFrame: sections ride along", () => {
  it("a section wholly inside a moved container moves its stored bounds; a spanning one stays", async () => {
    const { translateFrame } = await import("../src/engine/frames");
    const containers: Container[] = [{ id: "c", kind: "cloud", name: "c", collapsed: false, bounds: { x: 0, y: 0, w: 900, h: 700 } }];
    const nodes = [node("a", 100, 100, "c"), node("b", 200, 100, "c"), node("z", 2000, 0)];
    const sections = [
      { id: "inside", name: "in", color: "#000", nodeIds: ["a", "b"], collapsed: false, bounds: { x: 50, y: 50, w: 300, h: 200 } },
      { id: "spans", name: "sp", color: "#000", nodeIds: ["a", "z"], collapsed: false, bounds: { x: 0, y: 0, w: 2100, h: 200 } },
      { id: "empty", name: "e", color: "#000", nodeIds: [], collapsed: false, bounds: { x: 10, y: 10, w: 100, h: 100 } },
    ];
    const res = translateFrame({ nodes, containers, sections }, { kind: "container", id: "c" }, 30, 20);
    expect(res.sections.find((s) => s.id === "inside")!.bounds).toEqual({ x: 80, y: 70, w: 300, h: 200 });
    expect(res.sections.find((s) => s.id === "spans")!.bounds).toEqual({ x: 0, y: 0, w: 2100, h: 200 });
    expect(res.sections.find((s) => s.id === "empty")!.bounds).toEqual({ x: 10, y: 10, w: 100, h: 100 });
  });

  it("moving a section carries nested sections' members and bounds, not siblings", async () => {
    const { translateFrame, movedNodeIds } = await import("../src/engine/frames");
    const nodes = [node("a", 0, 0), node("b", 100, 0), node("c", 500, 0)];
    const sections = [
      { id: "p", name: "p", color: "#000", nodeIds: ["a"], collapsed: false, bounds: { x: 0, y: 0, w: 300, h: 200 } },
      { id: "child", name: "ch", color: "#000", parentId: "p", nodeIds: ["b"], collapsed: false, bounds: { x: 60, y: 60, w: 100, h: 80 } },
      { id: "sib", name: "s", color: "#000", nodeIds: ["c"], collapsed: false, bounds: { x: 400, y: 0, w: 200, h: 100 } },
    ];
    expect([...movedNodeIds({ nodes, containers: [], sections }, { kind: "section", id: "p" })].sort()).toEqual(["a", "b"]);
    const res = translateFrame({ nodes, containers: [], sections }, { kind: "section", id: "p" }, 10, 5);
    expect(res.nodes.find((n) => n.id === "b")!.position).toEqual({ x: 110, y: 5 });
    expect(res.nodes.find((n) => n.id === "c")!.position).toEqual({ x: 500, y: 0 });
    expect(res.sections.find((s) => s.id === "child")!.bounds).toEqual({ x: 70, y: 65, w: 100, h: 80 });
    expect(res.sections.find((s) => s.id === "sib")!.bounds).toEqual({ x: 400, y: 0, w: 200, h: 100 });
  });
});

describe("clampBounds", () => {
  it("never lets a frame shrink under its content floor", () => {
    const floor = { l: 100, t: 100, r: 500, b: 400 };
    expect(clampBounds({ x: 150, y: 150, w: 100, h: 50 }, floor)).toEqual({ x: 100, y: 100, w: 400, h: 300 });
    expect(clampBounds({ x: 50, y: 50, w: 600, h: 500 }, floor)).toEqual({ x: 50, y: 50, w: 600, h: 500 });
  });

  it("content floor is the padded content, independent of stored bounds", () => {
    const pinned: Container[] = [{ id: "r", kind: "region", name: "r", collapsed: false, bounds: { x: -999, y: -999, w: 5, h: 5 } }];
    const floor = contentBoxes([node("a", 300, 200, "r")], pinned, OPTS).get("r")!;
    expect(floor.l).toBe(300 - 100 - FRAME_PAD.region);
    expect(contentBoxes([], pinned, OPTS).get("r")).toBeNull();
  });
});

describe("placeNewFrame", () => {
  it("lands inside the parent, below existing siblings, else clear of everything", () => {
    const inParent = placeNewFrame("vpc", { l: 0, t: 0, r: 1000, b: 800 }, [], [{ l: 40, t: 60, r: 400, b: 300 }]);
    expect(inParent.x).toBeGreaterThan(0);
    expect(inParent.y).toBeGreaterThan(300);
    const clear = placeNewFrame("cloud", null, [{ l: 0, t: 0, r: 600, b: 400 }], []);
    expect(clear.x).toBeGreaterThan(600);
    expect(placeNewFrame("cloud", null, [], [])).toMatchObject({ x: 80, y: 80 });
  });
});
