import { describe, expect, it } from "vitest";
import { edgeGeometry, shapeOf } from "../src/canvas/edgeGeometry";

const icon = (x: number, y: number) => shapeOf({ x, y }, 200, 100, false);
const card = (x: number, y: number) => shapeOf({ x, y }, 200, 100, true);

function points(d: string): number[][] {
  return d
    .replace(/[MCLQ]/g, " ")
    .trim()
    .split(/\s+/)
    .map((p) => p.split(",").map(Number));
}

describe("edge geometry", () => {
  it("adjacent lanes route forward, anchored at icon rims", () => {
    const geo = edgeGeometry(icon(0, 0), icon(260, 0));
    expect(geo.caseKind).toBe("forward");
    const [p0, , , p3] = points(geo.d);
    expect(p0[0]).toBe(100 + 34); // source centre + rim
    expect(p3[0]).toBe(360 - 34); // target centre − rim
    expect(p0[1]).toBe(39);
  });

  it("card mode anchors at the card edge, mid-height", () => {
    const geo = edgeGeometry(card(0, 0), card(300, 0));
    const [p0, , , p3] = points(geo.d);
    expect(p0[0]).toBe(200);
    expect(p3[0]).toBe(300);
    expect(p0[1]).toBe(50);
  });

  it("a short back edge between neighbours draws an S-curve out the left", () => {
    const geo = edgeGeometry(icon(200, 0), icon(0, 0));
    expect(geo.caseKind).toBe("back");
    const [p0, p1, p2, p3] = points(geo.d);
    expect(p0[0]).toBe(300 - 34); // leaves source LEFT
    expect(p3[0]).toBe(100 + 34); // enters target RIGHT
    expect(p1[0]).toBeLessThanOrEqual(p0[0]);
    expect(p2[0]).toBeGreaterThanOrEqual(p3[0]);
  });

  it("a long back edge on the same row returns underneath it", () => {
    // the media pipeline's write-back: the worker sits two columns right of
    // the bucket it writes to, so an S-curve would run the line and its
    // label straight through whatever is between them
    const geo = edgeGeometry(icon(400, 0), icon(0, 0));
    expect(geo.caseKind).toBe("return");
    expect(geo.fromSide).toBe("bottom");
    expect(geo.toSide).toBe("bottom");
    const [p0, p1, p2, p3] = points(geo.d);
    expect(p0).toEqual([500, 39 + 34]); // bottom of the source icon
    expect(p3).toEqual([100, 39 + 34]); // bottom of the target icon
    expect(p1[1]).toBeGreaterThan(p0[1]); // both control points hang below
    expect(p2[1]).toBeGreaterThan(p3[1]);
  });

  it("a target below leaves the bottom and enters the top", () => {
    const geo = edgeGeometry(icon(0, 0), icon(0, 150));
    expect(geo.caseKind).toBe("down");
    expect(geo.fromSide).toBe("bottom");
    expect(geo.toSide).toBe("top");
    const [p0, p1, , p3] = points(geo.d);
    expect(p0).toEqual([100, 39 + 34]); // bottom of the source icon
    expect(p3).toEqual([100, 150 + 39 - 34]); // top of the target icon
    expect(p1[0]).toBe(p0[0]); // first control straight down: enters square
  });

  it("a target above leaves the top and enters the bottom", () => {
    const geo = edgeGeometry(icon(0, 200), icon(0, 0));
    expect(geo.caseKind).toBe("up");
    expect(geo.fromSide).toBe("top");
    expect(geo.toSide).toBe("bottom");
  });

  it("near-vertical pairs go vertical instead of hooking round the side", () => {
    // 60px horizontal, 200px vertical: no horizontal clearance, plenty vertical
    const geo = edgeGeometry(icon(0, 0), icon(60, 200));
    expect(geo.caseKind).toBe("down");
  });

  it("overlapping shapes bracket out the requested side", () => {
    const right = edgeGeometry(icon(0, 0), icon(20, 20), { outwardK: 1 });
    expect(right.caseKind).toBe("bracket");
    const [p0r, p1r] = points(right.d);
    expect(p1r[0]).toBeGreaterThan(p0r[0]);
    const left = edgeGeometry(icon(0, 0), icon(20, 20), { outwardK: -1 });
    const [p0l, p1l] = points(left.d);
    expect(p1l[0]).toBeLessThan(p0l[0]);
  });

  it("pinned anchors override the picked side for that end only", () => {
    const geo = edgeGeometry(icon(0, 0), icon(260, 0), { from: "top" });
    expect(geo.fromSide).toBe("top");
    expect(geo.toSide).toBe("left");
    expect(geo.caseKind).toBe("pinned");
    expect(geo.p0).toEqual({ x: 100, y: 39 - 34 });
  });

  it("card mode picks sides from the card box, not the icon rim", () => {
    const geo = edgeGeometry(card(0, 0), card(0, 140));
    expect(geo.caseKind).toBe("down");
    expect(geo.p0).toEqual({ x: 100, y: 50 + 38 });
    expect(geo.p3).toEqual({ x: 100, y: 140 + 50 - 38 });
  });

  it("coincident nodes still produce a drawable path", () => {
    const geo = edgeGeometry(icon(0, 0), icon(0, 0));
    const [p0, , , p3] = points(geo.d);
    expect(Number.isFinite(p0[0])).toBe(true);
    expect(p3[1]).not.toBe(p0[1]); // tangent nudge applied
  });
});

describe("edge fan", () => {
  it("a lone edge is unchanged by zero offsets", () => {
    const a = edgeGeometry(icon(0, 0), icon(260, 0));
    const b = edgeGeometry(icon(0, 0), icon(260, 0), { sourceOffset: 0, targetOffset: 0 });
    expect(b.d).toBe(a.d);
  });

  it("offsets move the anchors so converging arrowheads stay distinct", () => {
    const up = edgeGeometry(icon(0, 0), icon(260, 0), { targetOffset: -14 });
    const down = edgeGeometry(icon(0, 0), icon(260, 0), { targetOffset: 14 });
    const [, , , upEnd] = points(up.d);
    const [, , , downEnd] = points(down.d);
    expect(upEnd[1]).toBe(39 - 14);
    expect(downEnd[1]).toBe(39 + 14);
    expect(upEnd[0]).toBe(downEnd[0]); // same rim x, different y
  });
});

describe("fan on vertical sides", () => {
  it("offsets run along the side — x on top/bottom anchors", async () => {
    const geo = edgeGeometry(icon(0, 0), icon(0, 150), { sourceOffset: 14, targetOffset: -14 });
    expect(geo.p0).toEqual({ x: 114, y: 73 });
    expect(geo.p3).toEqual({ x: 86, y: 155 });
  });
});

describe("waypoints and shapes", () => {
  it("a curve through waypoints passes through every point, entering square", async () => {
    const { buildEdge } = await import("../src/canvas/edgeGeometry");
    const wp = [{ x: 200, y: 140 }];
    const geo = buildEdge(icon(0, 0), icon(260, 0), { waypoints: wp });
    expect(geo.points).toEqual([geo.p0, wp[0], geo.p3]);
    const segs = geo.d.split(" C");
    expect(segs).toHaveLength(3); // M + two cubic segments
    const firstEnd = segs[1].split(" ")[2].split(",").map(Number);
    expect(firstEnd).toEqual([200, 140]);
    const c1 = segs[1].split(" ")[0].split(",").map(Number);
    expect(c1[1]).toBe(geo.p0.y); // leaves along the right-side normal
    expect(geo.mids).toHaveLength(2);
  });

  it("straight shape is a polyline through the waypoints", async () => {
    const { buildEdge } = await import("../src/canvas/edgeGeometry");
    const geo = buildEdge(icon(0, 0), icon(260, 0), { shape: "straight", waypoints: [{ x: 200, y: 140 }] });
    expect(geo.d).toBe("M134,39 L200,140 L326,39");
    expect(geo.mids).toHaveLength(2);
  });

  it("step shape is axis-aligned everywhere", async () => {
    const { buildEdge } = await import("../src/canvas/edgeGeometry");
    const geo = buildEdge(icon(0, 0), icon(260, 120), { shape: "step" });
    const pts = points(geo.d);
    for (let i = 1; i < pts.length; i++) {
      const sameX = pts[i][0] === pts[i - 1][0];
      const sameY = pts[i][1] === pts[i - 1][1];
      expect(sameX || sameY).toBe(true);
    }
    expect(pts[0]).toEqual([134, 39]);
    expect(pts[pts.length - 1]).toEqual([326, 159]);
  });

  it("a self-loop leaves the right and returns to the top", async () => {
    const { loopPath } = await import("../src/canvas/edgeGeometry");
    const geo = loopPath(icon(0, 0));
    expect(Number.isFinite(geo.p0.x)).toBe(true);
    expect(geo.p0.x).toBe(134);
    expect(geo.p3.y).toBe(39 - 34);
    expect(geo.mids).toHaveLength(1);
  });
});
