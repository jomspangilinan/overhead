// The showcase sample is built to be reviewed, and the review is the point.
//
// `saas-platform` carries eight deliberate problems · each one a thing a
// consultant flags in a real design, spread across eight nodes so none of
// them reads as a pile-up. They are load-bearing: the findings loop is
// demonstrated on this drawing, and a rule whose arithmetic moves (a price
// list refresh shifting the DynamoDB crossover, say) could quietly stop one
// firing and nobody would notice until it was on camera. So the intent is
// written down here rather than left in the JSON.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { migrateSnapshot } from "../src/engine/migrate";
import { allFindings } from "../src/engine/findings";
import { monthlyTotal } from "../src/engine/cost";
import { getService, servicesInFamily } from "../src/engine/services";
import type { StateSnapshot } from "../src/engine/model";
import type { PricingTable } from "../src/engine/pricing";

const snap = migrateSnapshot(
  JSON.parse(readFileSync(join(__dirname, "..", "samples", "saas-platform.json"), "utf8")) as StateSnapshot,
);
const pricing = JSON.parse(
  readFileSync(join(__dirname, "..", "data", "pricing.ap-southeast-1.json"), "utf8"),
) as PricingTable;

describe("saas-platform", () => {
  it("fires the eight findings it is built to fire, on the nodes it means", () => {
    const got = allFindings(snap, pricing).map((f) => [f.rule, f.severity, f.nodeIds[0]]);
    expect(got.sort()).toEqual(
      [
        ["async_no_dlq", "critical", "job-worker"],
        ["memory_duration_tradeoff", "info", "emailer"],
        ["no_lifecycle_on_logs", "warn", "audit-logs"],
        ["on_demand_steady_state", "warn", "tenants"],
        ["rest_where_http_would_do", "warn", "public-api"],
        ["standard_workflow_high_volume", "warn", "onboarding"],
        ["unbounded_fanout", "warn", "notify-topic"],
        ["x86_lambda", "warn", "job-worker"],
      ].sort(),
    );
  });

  it("holds one of every priced service · it is the catalogue, drawn", () => {
    const used = new Set(snap.nodes.map((n) => n.service));
    for (const def of servicesInFamily("aws")) expect(used.has(def.id), def.id).toBe(true);
  });

  it("nests four levels deep and puts a Lambda in the subnet", () => {
    expect(snap.containers.map((c) => c.kind)).toEqual(["cloud", "region", "vpc", "subnetpri"]);
    expect(snap.nodes.find((n) => n.id === "report-runner")!.container).toBe("priv-a");
  });

  it("prices to a believable number, and every AWS resource carries one", () => {
    const total = monthlyTotal(snap, pricing);
    expect(total).toBeGreaterThan(500);
    expect(total).toBeLessThan(3000);
    // The flow shapes are the parts AWS does not bill for · they are here
    // on purpose and must stay unpriced.
    const flow = snap.nodes.filter((n) => (getService(n.service)?.family ?? "aws") === "flow");
    expect(flow.map((n) => n.id).sort()).toEqual(["customer", "stripe", "warehouse"]);
  });
});
