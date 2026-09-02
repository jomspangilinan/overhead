// Support harness for scripts/synth-samples.ts: when WRITE_CDK_STACKS is
// set, writes each sample's generated CDK stack to that directory so the
// synth script can compile them. Without the env var it just asserts the
// generator runs.

import { describe, expect, it } from "vitest";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { exportCdk } from "../src/engine/exporters";
import type { StateSnapshot } from "../src/engine/model";
import type { PricingTable } from "../src/engine/pricing";

const pricing = JSON.parse(
  readFileSync(join(__dirname, "..", "data", "pricing.us-east-1.json"), "utf8"),
) as PricingTable;

const SAMPLES = ["api-backend", "media-pipeline", "event-driven"];

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
});
