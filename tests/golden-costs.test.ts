// Golden monthly costs for the three seeded sample architectures.
// If a pricing refresh moves these, the new numbers must be reviewed —
// that's the point of the goldens.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { monthlyTotal, allCosts } from "../src/engine/cost";
import { DEFAULT_TRAFFIC, toMoney, type StateSnapshot } from "../src/engine/model";
import { SERVICES, servicesInFamily } from "../src/engine/services";
import { defaultSettings } from "../src/engine/defineService";
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

// One node per service at its defaults, priced in both regions. This is the
// test that fails the moment a service's price() names a key the pricing
// data does not have · which is the only way a new service can be wrong and
// still look right on the canvas.
// The one service that is genuinely free at its defaults, and says so.
const FREE_AT_DEFAULTS = new Set(["ssmparameter"]);

describe("every service prices at its defaults", () => {
  // The flow shapes (services/flow.ts) have no SKU behind them by design ·
  // `services/index` splits them out, and define-service.test asserts it.
  for (const def of servicesInFamily("aws")) {
    const id = def.id;
    it(id, () => {
      const settings = defaultSettings(def);
      for (const table of [use1, aps1]) {
        const lines = def.price(settings, DEFAULT_TRAFFIC, table);
        if (!FREE_AT_DEFAULTS.has(id)) expect(lines.length, id).toBeGreaterThan(0);
        for (const l of lines) {
          expect(l.rate, `${id} ${l.sku}`).toBeGreaterThan(0);
          expect(l.qty, `${id} ${l.sku}`).toBeGreaterThanOrEqual(0);
          expect(l.sourceUrl, `${id} ${l.sku}`).toMatch(/^https:\/\/pricing\./);
        }
      }
    });
  }

  it("encryption is not free · a customer managed key costs a dollar a month before it is used", () => {
    const kms = SERVICES.kms;
    const idle = { ...defaultSettings(kms), requestsPerMonth: 0 };
    expect(toMoney(kms.price(idle, DEFAULT_TRAFFIC, use1).reduce((n, l) => n + l.monthly, 0))).toBe(1);
    // an AWS managed key is free to hold · only its requests are billed
    const awsManaged = { ...idle, keyType: "aws-managed" };
    expect(kms.price(awsManaged, DEFAULT_TRAFFIC, use1).reduce((n, l) => n + l.monthly, 0)).toBe(0);
  });

  it("a standard parameter at standard throughput costs nothing, which is the point of it", () => {
    const ps = SERVICES.ssmparameter;
    expect(ps.price(defaultSettings(ps), DEFAULT_TRAFFIC, use1)).toEqual([]);
    const advanced = { ...defaultSettings(ps), tier: "advanced" };
    expect(ps.price(advanced, DEFAULT_TRAFFIC, use1).length).toBe(2);
  });
});

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
