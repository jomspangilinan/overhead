// A trace is a set and a sequence · both come from one walk so they cannot
// disagree (`engine/trace.ts`).

import { describe, expect, it } from "vitest";
import { traceFrom } from "../src/engine/trace";
import type { ArchEdge } from "../src/engine/model";

const e = (from: string, to: string): ArchEdge => ({ id: `${from}>${to}`, from, to, kind: "sync" });

describe("traceFrom", () => {
  it("reaches everything downstream, origin first", () => {
    const { nodeIds } = traceFrom([e("api", "fn"), e("fn", "db"), e("fn", "q")], "api");
    expect(nodeIds[0]).toBe("api");
    expect([...nodeIds].sort()).toEqual(["api", "db", "fn", "q"]);
  });

  it("gives one branch per route to a leaf, longest first", () => {
    // api → fn, fn → db, fn → q → worker · two routes, and the pulse should
    // open on the one that says the most.
    const { branches } = traceFrom([e("api", "fn"), e("fn", "db"), e("fn", "q"), e("q", "worker")], "api");
    expect(branches).toEqual([
      ["api>fn", "fn>q", "q>worker"],
      ["api>fn", "fn>db"],
    ]);
  });

  it("counts a rejoin as two routes, because a request takes both", () => {
    const { branches } = traceFrom([e("a", "b"), e("a", "c"), e("b", "d"), e("c", "d")], "a");
    expect(branches).toHaveLength(2);
    expect(branches.every((b) => b.length === 2)).toBe(true);
  });

  it("does not run forever on a cycle", () => {
    const { nodeIds, branches } = traceFrom([e("a", "b"), e("b", "c"), e("c", "a")], "a");
    expect([...nodeIds].sort()).toEqual(["a", "b", "c"]);
    expect(branches).toEqual([["a>b", "b>c"]]);
  });

  it("is empty-branched at a leaf, so nothing pulses on a dead end", () => {
    expect(traceFrom([e("a", "b")], "b")).toEqual({ nodeIds: ["b"], branches: [] });
  });

  it("ignores a self-loop rather than pulsing on the spot", () => {
    const { branches } = traceFrom([e("a", "a"), e("a", "b")], "a");
    expect(branches).toEqual([["a>b"]]);
  });
});
