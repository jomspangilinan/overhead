import { describe, expect, it } from "vitest";
import { edgeGeometry, shapeOf } from "../src/canvas/edgeGeometry";

const icon = (x: number, y: number) => shapeOf({ x, y }, 200, 100, false);
const card = (x: number, y: number) => shapeOf({ x, y }, 200, 100, true);

function points(d: string): number[][] {
  return d
    .replace(/[MC]/g, " ")
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

  it("target left of source draws a back S-curve, monotonic in x when level", () => {
    const geo = edgeGeometry(icon(400, 0), icon(0, 0));
    expect(geo.caseKind).toBe("back");
    const [p0, p1, p2, p3] = points(geo.d);
    expect(p0[0]).toBe(500 - 34); // leaves source LEFT
    expect(p3[0]).toBe(100 + 34); // enters target RIGHT
    expect(p1[0]).toBeLessThanOrEqual(p0[0]);
    expect(p2[0]).toBeGreaterThanOrEqual(p3[0]);
    expect(p1[0]).toBeGreaterThanOrEqual(p2[0]); // no wiggle
  });

  it("same column brackets out the requested side", () => {
    const right = edgeGeometry(icon(0, 0), icon(0, 150), { outwardK: 1 });
    expect(right.caseKind).toBe("bracket");
    const [p0r, p1r] = points(right.d);
    expect(p1r[0]).toBeGreaterThan(p0r[0]);

    const left = edgeGeometry(icon(0, 0), icon(0, 150), { outwardK: -1 });
    const [p0l, p1l] = points(left.d);
    expect(p1l[0]).toBeLessThan(p0l[0]);
  });

  it("near-vertical pairs bracket instead of hooking", () => {
    // 60px horizontal, 200px vertical: forward gap (−8) < tolerance
    const geo = edgeGeometry(icon(0, 0), icon(60, 200));
    expect(geo.caseKind).toBe("bracket");
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
