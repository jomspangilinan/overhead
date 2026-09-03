// Auto-layout is container-aware: every frame lays out its own contents,
// frames never overlap, and columns come from the graph (dependency depth),
// not from the services' roles.

import { describe, expect, it } from "vitest";
import type { Container } from "../src/engine/containers";
import type { ArchNode, ArchEdge } from "../src/engine/model";
import { autoLayout, autoLayoutWithSections, COL_GAP, ROW_GAP, textWidth, crossingsOf } from "../src/engine/layout";
import type { Bounds } from "../src/engine/frames";

const OPTS = { nodeW: 200, nodeH: 100 };

function node(id: string, service: ArchNode["service"], container?: string): ArchNode {
  return { id, service, name: id, settings: {}, container, position: { x: 0, y: 0 } };
}
const edge = (from: string, to: string): ArchEdge => ({ id: `${from}-${to}`, from, to, kind: "sync" });

const overlaps = (a: Bounds, b: Bounds) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const holds = (b: Bounds, p: { x: number; y: number }) => p.x - 100 >= b.x && p.x + 100 <= b.x + b.w && p.y - 50 >= b.y && p.y + 50 <= b.y + b.h;

describe("autoLayout", () => {
  it("columns follow the edges, not the roles", () => {
    // s3 (data) feeds sqs (messaging) feeds lambda (handlers): by role that
    // reads right to left, by dependency it reads left to right
    const nodes = [node("bucket", "s3"), node("queue", "sqs"), node("fn", "lambda")];
    const { positions } = autoLayout(nodes, [edge("bucket", "queue"), edge("queue", "fn")], [], OPTS);
    expect(positions.queue.x - positions.bucket.x).toBe(OPTS.nodeW + COL_GAP);
    expect(positions.fn.x - positions.queue.x).toBe(OPTS.nodeW + COL_GAP);
    expect(positions.bucket.y).toBe(positions.fn.y);
  });

  it("ignores the back edge of a cycle so a write-back never pulls its target forward", () => {
    // the media pipeline: cdn → assets → queue → worker → assets
    const nodes = [node("cdn", "cloudfront"), node("assets", "s3"), node("queue", "sqs"), node("worker", "lambda")];
    const { positions } = autoLayout(
      nodes,
      [edge("cdn", "assets"), edge("assets", "queue"), edge("queue", "worker"), edge("worker", "assets")],
      [],
      OPTS,
    );
    const col = (id: string) => Math.round((positions[id].x - positions.cdn.x) / (OPTS.nodeW + COL_GAP));
    expect([col("cdn"), col("assets"), col("queue"), col("worker")]).toEqual([0, 1, 2, 3]);
  });

  it("stacks unconnected resources in one column", () => {
    const { positions } = autoLayout([node("fn", "lambda"), node("db", "dynamodb")], [], [], OPTS);
    expect(positions.db.x).toBe(positions.fn.x);
    expect(positions.db.y - positions.fn.y).toBe(OPTS.nodeH + ROW_GAP);
  });

  it("opens the gap an edge label has to sit in", () => {
    const nodes = [node("bucket", "s3"), node("queue", "sqs")];
    const labelled: ArchEdge = { id: "e", from: "bucket", to: "queue", kind: "async", label: "upload events from the ingest bucket" };
    const plain = autoLayout(nodes, [edge("bucket", "queue")], [], OPTS);
    const wide = autoLayout(nodes, [labelled], [], OPTS);
    const gapOf = (p: Record<string, { x: number }>) => p.queue.x - p.bucket.x - OPTS.nodeW;
    expect(gapOf(plain.positions)).toBe(COL_GAP);
    expect(gapOf(wide.positions)).toBeGreaterThanOrEqual(textWidth(labelled.label!, 5.4));
  });

  it("widens a column for a name longer than the node", () => {
    const long = node("a", "lambda");
    long.name = "checkout-order-fulfilment-notification-handler";
    const { positions } = autoLayout([long, node("b", "sqs")], [edge("a", "b")], [], OPTS);
    expect(positions.b.x - positions.a.x).toBeGreaterThan(OPTS.nodeW + COL_GAP);
  });

  it("spaces icons by the icon, and still reserves the hit-box", () => {
    // A row of 56px icons pitched as if each were a 200px card reads as four
    // unrelated things rather than a chain · the drawing you are looking at
    // is the one it is spaced for, and K re-arranges when you switch.
    const chain = [node("a", "cloudfront"), node("b", "s3"), node("c", "sqs")];
    const edges = [edge("a", "b"), edge("b", "c")];
    const cards = autoLayout(chain, edges, [], OPTS);
    const icons = autoLayout(chain, edges, [], { ...OPTS, drawW: 68, drawH: 80 });
    const pitch = (p: Record<string, { x: number }>) => p.b.x - p.a.x;
    // a one-character name never widens a column past the icon itself
    expect(pitch(icons.positions)).toBe(68 + COL_GAP);
    expect(pitch(icons.positions)).toBeLessThan(pitch(cards.positions));
    // the block still holds every hit-box · the first centre is half a
    // hit-box in, not half an icon, or a frame around it would clip
    expect(icons.positions.a.x).toBe(cards.positions.a.x);
  });

  it("icon spacing still fits every node inside its frame", () => {
    const containers: Container[] = [{ id: "vpc", kind: "vpc", name: "vpc", collapsed: false }];
    const nodes = [node("a", "lambda", "vpc"), node("b", "sqs", "vpc"), node("c", "s3", "vpc")];
    const { positions, frames } = autoLayout(nodes, [edge("a", "b")], containers, {
      ...OPTS,
      drawW: 68,
      drawH: 80,
    });
    for (const n of nodes) expect(holds(frames.vpc, positions[n.id]), n.id).toBe(true);
  });

  it("keeps every node inside its own frame and sibling frames apart", () => {
    const containers: Container[] = [
      { id: "cloud", kind: "cloud", name: "AWS Cloud", collapsed: false },
      { id: "region", kind: "region", name: "ap-southeast-1", parent: "cloud", collapsed: false },
      { id: "vpc", kind: "vpc", name: "vpc", parent: "region", collapsed: false },
      { id: "a", kind: "subnetpri", name: "private-a", parent: "vpc", collapsed: false },
      { id: "b", kind: "subnetpri", name: "private-b", parent: "vpc", collapsed: false },
    ];
    const nodes = [
      node("api", "apigateway", "region"),
      node("fn-a", "lambda", "a"),
      node("fn-b", "lambda", "b"),
      node("db", "dynamodb", "region"),
      node("queue", "sqs"),
    ];
    const { positions, frames } = autoLayout(nodes, [edge("api", "fn-a")], containers, OPTS);
    for (const n of nodes) {
      if (!n.container) continue;
      expect(holds(frames[n.container], positions[n.id])).toBe(true);
    }
    expect(overlaps(frames.a, frames.b)).toBe(false);
    // child frames sit inside their parent
    const within = (inner: Bounds, outer: Bounds) => inner.x > outer.x && inner.y > outer.y && inner.x + inner.w < outer.x + outer.w && inner.y + inner.h < outer.y + outer.h;
    expect(within(frames.a, frames.vpc)).toBe(true);
    expect(within(frames.vpc, frames.region)).toBe(true);
    expect(within(frames.region, frames.cloud)).toBe(true);
    // the free node is not inside any frame
    expect(Object.values(frames).some((f) => holds(f, positions.queue))).toBe(false);
  });

  it("orders rows so a target sits beside its source", () => {
    const nodes = [node("api1", "apigateway"), node("api2", "apigateway"), node("fn1", "lambda"), node("fn2", "lambda")];
    // fn1 is fed by api2, fn2 by api1 · rows should swap
    const { positions } = autoLayout(nodes, [edge("api2", "fn1"), edge("api1", "fn2")], [], OPTS);
    expect(positions.fn2.y).toBe(positions.api1.y);
    expect(positions.fn1.y).toBe(positions.api2.y);
  });

  it("emits column sections only for resources outside every frame", () => {
    const containers: Container[] = [{ id: "region", kind: "region", name: "r", collapsed: false }];
    const nodes = [node("fn", "lambda", "region"), node("db", "dynamodb"), node("db2", "dynamodb")];
    const { sections } = autoLayoutWithSections(nodes, [], containers, OPTS);
    expect(sections.map((s) => s.nodeIds)).toEqual([["db", "db2"]]);
  });

  it("centres a column on the drawing, so a fan converges", () => {
    // Three sources into one target: top-aligned, the target sits level with
    // the *first* source and the other two arrive as long diagonals climbing
    // to it. Centred, it sits in the middle of the three · which is how
    // anybody draws a fan-in by hand, and what the user asked for.
    const nodes = ["a", "b", "c", "hub"].map((id) => node(id, "lambda"));
    const edges = [edge("a", "hub"), edge("b", "hub"), edge("c", "hub")];
    const { positions } = autoLayout(nodes, edges, [], OPTS);
    expect(positions.hub.y).toBe(positions.b.y);
    expect(positions.a.y).toBeLessThan(positions.hub.y);
    expect(positions.c.y).toBeGreaterThan(positions.hub.y);
  });

  it("keeps the top-aligned arrangement when centring would cross more", () => {
    // Centring is readability, not a rule · it is chosen only when the
    // measured crossings do not get worse (`crossingsOf`). Whichever wins,
    // the drawing must never come out worse than top-aligning would be.
    const nodes = ["a", "b", "c", "d", "e", "f"].map((id) => node(id, "lambda"));
    const edges = [edge("a", "d"), edge("b", "e"), edge("c", "f"), edge("a", "f")];
    const { positions } = autoLayout(nodes, edges, [], OPTS);
    expect(crossingsOf(edges, positions)).toBeLessThanOrEqual(1);
  });

  it("opens a lane for an edge that skips a column", () => {
    // a --> c skips the column b is in. The placeholder that keeps it in the
    // ordering now takes a row as well, so b moves out of the line's way ·
    // before this the edge was drawn straight through b, and arrived at c
    // alongside b --> c as one thick line.
    const nodes = ["a", "b", "c"].map((id) => node(id, "lambda"));
    const edges = [edge("a", "b"), edge("b", "c"), edge("a", "c")];
    const { positions } = autoLayout(nodes, edges, [], OPTS);
    expect(positions.a.y).toBe(positions.c.y);
    expect(positions.b.y).toBeGreaterThan(positions.a.y);
  });

  it("keeps depth for a path that leaves a frame", () => {
    // p and q are both outside, both fed by the frame, and there is no edge
    // between them · to this scope they look identical. They are not: q is a
    // step further into the drawing, and a column each is what says so.
    // Before, everything a frame fed shared one column, which is how
    // checkout-flow came out with the payment provider and the warehouse
    // ledger stacked together and the arrows crossing between them.
    const containers: Container[] = [{ id: "f", kind: "vpc", name: "f", collapsed: false }];
    const nodes = [
      node("a", "apigateway"),
      node("b", "lambda", "f"),
      node("c", "lambda", "f"),
      node("p", "dynamodb"),
      node("q", "dynamodb"),
    ];
    const edges = [edge("a", "b"), edge("b", "p"), edge("b", "c"), edge("c", "q")];
    const { positions } = autoLayout(nodes, edges, containers, OPTS);
    expect(positions.q.x).toBeGreaterThan(positions.p.x);
  });

  it("never boxes flow shapes in a role section", () => {
    // An auto section is named after a role ("Data", "Ingress"), and a flow
    // shape has no role · a decision and a start marker sharing a column are
    // not "Data" and a box saying so is worse than no box.
    const nodes = [node("ok", "decision"), node("done", "terminal"), node("db", "dynamodb"), node("db2", "dynamodb")];
    const { sections } = autoLayoutWithSections(nodes, [], [], OPTS);
    expect(sections.flatMap((s) => s.nodeIds).sort()).toEqual(["db", "db2"]);
  });

  it("never boxes a lone resource in a section", () => {
    const nodes = [node("api", "apigateway"), node("fn", "lambda"), node("db", "dynamodb")];
    const { sections } = autoLayoutWithSections(nodes, [edge("api", "fn"), edge("fn", "db")], [], OPTS);
    expect(sections).toEqual([]);
  });
});
