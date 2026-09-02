// Auto-layout is container-aware: every frame lays out its own contents,
// frames never overlap, and columns come from the graph (dependency depth),
// not from the services' roles.

import { describe, expect, it } from "vitest";
import type { Container } from "../src/engine/containers";
import type { ArchNode, ArchEdge } from "../src/engine/model";
import { autoLayout, autoLayoutWithSections } from "../src/engine/layout";
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
    expect(positions.queue.x - positions.bucket.x).toBe(OPTS.nodeW + 80);
    expect(positions.fn.x - positions.queue.x).toBe(OPTS.nodeW + 80);
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
    const col = (id: string) => Math.round((positions[id].x - positions.cdn.x) / (OPTS.nodeW + 80));
    expect([col("cdn"), col("assets"), col("queue"), col("worker")]).toEqual([0, 1, 2, 3]);
  });

  it("stacks unconnected resources in one column", () => {
    const { positions } = autoLayout([node("fn", "lambda"), node("db", "dynamodb")], [], [], OPTS);
    expect(positions.db.x).toBe(positions.fn.x);
    expect(positions.db.y - positions.fn.y).toBe(OPTS.nodeH + 50);
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

  it("never boxes a lone resource in a section", () => {
    const nodes = [node("api", "apigateway"), node("fn", "lambda"), node("db", "dynamodb")];
    const { sections } = autoLayoutWithSections(nodes, [edge("api", "fn"), edge("fn", "db")], [], OPTS);
    expect(sections).toEqual([]);
  });
});
