import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { computeDelta } from "../src/engine/delta";
import type { StateSnapshot } from "../src/engine/model";
import type { PricingTable } from "../src/engine/pricing";

const pricing = JSON.parse(
  readFileSync(join(__dirname, "..", "data", "pricing.us-east-1.json"), "utf8"),
) as PricingTable;
const base = JSON.parse(
  readFileSync(join(__dirname, "..", "samples", "api-backend.json"), "utf8"),
) as StateSnapshot;

describe("delta", () => {
  it("is empty when nothing changed", () => {
    const d = computeDelta(base, structuredClone(base), pricing);
    expect(d.delta).toBe(0);
    expect(d.nodes).toHaveLength(0);
  });

  it("prices an architecture change per node and in total", () => {
    const fork = structuredClone(base);
    const handler = fork.nodes.find((n) => n.id === "handler")!;
    handler.settings.architecture = "x86_64";
    const d = computeDelta(base, fork, pricing);
    expect(d.delta).toBeGreaterThan(0);
    expect(d.nodes[0].id).toBe("handler");
    expect(d.forkTotal).toBeCloseTo(d.baseTotal + d.delta, 2);
  });

  it("marks removed nodes with a null fork cost", () => {
    const fork = structuredClone(base);
    fork.nodes = fork.nodes.filter((n) => n.id !== "table");
    const d = computeDelta(base, fork, pricing);
    const removed = d.nodes.find((n) => n.id === "table")!;
    expect(removed.fork).toBeNull();
    expect(removed.delta).toBeLessThan(0);
  });
});
