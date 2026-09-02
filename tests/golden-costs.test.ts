// Golden monthly costs for the three seeded sample architectures.
// If a pricing refresh moves these, the new numbers must be reviewed —
// that's the point of the goldens.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { monthlyTotal, allCosts } from "../src/engine/cost";
import { toMoney, type StateSnapshot } from "../src/engine/model";
import type { PricingTable } from "../src/engine/pricing";

function load<T>(...p: string[]): T {
  return JSON.parse(readFileSync(join(__dirname, "..", ...p), "utf8")) as T;
}

const use1 = load<PricingTable>("data", "pricing.us-east-1.json");
const aps1 = load<PricingTable>("data", "pricing.ap-southeast-1.json");

const samples = {
  "api-backend": load<StateSnapshot>("samples", "api-backend.json"),
  "media-pipeline": load<StateSnapshot>("samples", "media-pipeline.json"),
  "event-driven": load<StateSnapshot>("samples", "event-driven.json"),
};

// { sample: [us-east-1, ap-southeast-1] }
const GOLDEN: Record<keyof typeof samples, [number, number]> = {
  "api-backend": [16.57, 18.37],
  "media-pipeline": [39.29, 49.24],
  "event-driven": [385.73, 511.89],
};

describe("golden monthly costs", () => {
  for (const [name, snap] of Object.entries(samples) as [
    keyof typeof samples,
    StateSnapshot,
  ][]) {
    it(`${name} matches its golden total`, () => {
      expect(toMoney(monthlyTotal(snap, use1))).toBe(GOLDEN[name][0]);
      expect(toMoney(monthlyTotal(snap, aps1))).toBe(GOLDEN[name][1]);
    });

    it(`${name} has a cost line with provenance for every node`, () => {
      for (const cost of allCosts(snap, use1)) {
        expect(cost.lines.length).toBeGreaterThan(0);
        for (const line of cost.lines) {
          expect(line.sourceUrl).toMatch(/^https:\/\/pricing\.us-east-1\.amazonaws\.com\//);
          expect(line.rate).toBeGreaterThan(0);
          expect(line.monthly).toBe(line.qty * line.rate);
        }
      }
    });
  }
});
