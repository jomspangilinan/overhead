// Auto-layout's job is not only to place things, it is to make the drawing
// readable · and what makes a diagram unreadable is edges crossing each
// other. So this measures that, geometrically, on the arrangement the engine
// actually produces: how many pairs of connection lines intersect.
//
// The numbers below are ceilings, not targets. They may go down when the
// ordering improves; if one goes up, the layout got worse for somebody.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { autoLayout, COL_GAP, crossingsOf } from "../src/engine/layout";
import { migrateSnapshot } from "../src/engine/migrate";
import { NODE_W, NODE_H, ICON_DRAW_W, ICON_DRAW_H } from "../src/canvas/nodeMetrics";
import type { ArchEdge, ArchNode, StateSnapshot } from "../src/engine/model";

const OPTS = { nodeW: NODE_W, nodeH: NODE_H, drawW: ICON_DRAW_W, drawH: ICON_DRAW_H };

const sample = (name: string): StateSnapshot =>
  migrateSnapshot(JSON.parse(readFileSync(join(__dirname, "..", "samples", `${name}.json`), "utf8")));

// The counter lives in the engine now · `autoLayout` uses it to choose
// between two arrangements (centred columns vs top-aligned), so the measure
// the tests hold it to and the measure it optimises against are the same one.
export const countCrossings = crossingsOf;

const node = (id: string, container?: string): ArchNode => ({
  id,
  service: "lambda",
  name: id,
  settings: {},
  container,
  position: { x: 0, y: 0 },
});
const edge = (from: string, to: string): ArchEdge => ({ id: `${from}-${to}`, from, to, kind: "sync" });

describe("crossings in the seeded drawings", () => {
  for (const [name, ceiling] of [
    ["api-backend", 0],
    ["media-pipeline", 0],
    ["event-driven", 0],
    ["partner-checkout", 0],
    ["refund-approval", 0],
    // 26 resources over four container levels · a real architecture has
    // some, and the measured number is the ceiling so it cannot creep.
    ["saas-platform", 1],
  ] as const) {
    it(`${name}: at most ${ceiling}`, () => {
      const snap = sample(name);
      const { positions } = autoLayout(snap.nodes, snap.edges, snap.containers, OPTS);
      expect(countCrossings(snap.edges, positions)).toBeLessThanOrEqual(ceiling);
    });
  }
});

describe("the ordering earns it", () => {
  it("a fan that reads straight across does not cross itself", () => {
    // one source into four workers, each into its own sink · every ordering
    // but the matched one crosses, and the sweeps have to find it
    const nodes = [node("src"), ...[1, 2, 3, 4].flatMap((i) => [node(`w${i}`), node(`s${i}`)])];
    const edges = [
      ...[1, 2, 3, 4].map((i) => edge("src", `w${i}`)),
      // deliberately declared in an order that does not match the workers'
      ...[
        edge("w1", "s3"),
        edge("w2", "s1"),
        edge("w3", "s4"),
        edge("w4", "s2"),
      ],
    ];
    const { positions } = autoLayout(nodes, edges, [], OPTS);
    expect(countCrossings(edges, positions)).toBe(0);
  });

  it("an edge that skips a column is ordered around, not through", () => {
    // a → b → c → d, plus a → d over the top of it, plus a second chain
    const nodes = ["a", "b", "c", "d", "x", "y"].map((id) => node(id));
    const edges = [
      edge("a", "b"),
      edge("b", "c"),
      edge("c", "d"),
      edge("a", "d"),
      edge("x", "y"),
      edge("y", "d"),
    ];
    const { positions } = autoLayout(nodes, edges, [], OPTS);
    expect(countCrossings(edges, positions)).toBeLessThanOrEqual(1);
  });

  it("still puts a target beside its source", () => {
    const nodes = ["api1", "api2", "fn1", "fn2"].map((id) => node(id));
    const { positions } = autoLayout(nodes, [edge("api2", "fn1"), edge("api1", "fn2")], [], OPTS);
    expect(positions.fn2.y).toBe(positions.api1.y);
    expect(positions.fn1.y).toBe(positions.api2.y);
    expect(positions.fn1.x - positions.api1.x).toBe(ICON_DRAW_W + COL_GAP);
  });
});
