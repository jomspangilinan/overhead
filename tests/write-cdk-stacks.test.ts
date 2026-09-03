// Support harness for scripts/synth-samples.ts: when WRITE_CDK_STACKS is
// set, writes each sample's generated CDK stack to that directory so the
// synth script can compile them. Without the env var it just asserts the
// generator runs.

import { describe, expect, it } from "vitest";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { exportCdk } from "../src/engine/exporters";
import { DEFAULT_TRAFFIC, type StateSnapshot } from "../src/engine/model";
import { SERVICES } from "../src/engine/services";
import { defaultSettings } from "../src/engine/defineService";
import type { PricingTable } from "../src/engine/pricing";

const pricing = JSON.parse(
  readFileSync(join(__dirname, "..", "data", "pricing.us-east-1.json"), "utf8"),
) as PricingTable;

const SAMPLES = ["api-backend", "media-pipeline", "event-driven", "partner-checkout", "saas-platform"];

/** One node per service, at its defaults · the fixture that keeps a newly
 *  added service from shipping CDK that does not compile. */
function allServices(): StateSnapshot {
  return {
    nodes: Object.values(SERVICES).map((def, i) => ({
      id: def.id,
      service: def.id,
      name: `${def.id}-one`,
      settings: defaultSettings(def),
      position: { x: i * 240, y: 0 },
    })),
    edges: [],
    containers: [],
    sections: [],
    traffic: DEFAULT_TRAFFIC,
  };
}

describe("cdk stack generation", () => {
  it("generates a stack for every sample (and writes them when asked)", () => {
    const outDir = process.env.WRITE_CDK_STACKS;
    if (outDir) mkdirSync(outDir, { recursive: true });
    for (const name of SAMPLES) {
      const snap = JSON.parse(
        readFileSync(join(__dirname, "..", "samples", `${name}.json`), "utf8"),
      ) as StateSnapshot;
      const ts = exportCdk(snap, pricing);
      expect(ts).toContain("cdk.Stack");
      if (outDir) writeFileSync(join(outDir, `${name}.ts`), ts);
    }
  });

  it("generates a stack holding every service", () => {
    const outDir = process.env.WRITE_CDK_STACKS;
    const ts = exportCdk(allServices(), pricing);
    for (const def of Object.values(SERVICES)) expect(ts, def.id).toContain(`${def.id}-one`);
    if (outDir) writeFileSync(join(outDir, "all-services.ts"), ts);
  });
});
