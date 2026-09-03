// The seeded samples are drawings, not sketches.
//
// They used to carry hand-placed positions from an earlier build (a flat
// 240px grid, no frame padding, no container bounds), so every path that
// loaded one had to arrange it again to look right · the app did that when
// it seeded, and the Import dialog did not, which is why importing
// event-driven came out looking nothing like the app's own copy of it.
//
// The fix is not another auto-layout call at the point of loading: it is for
// a sample to be laid out **on disk**, so "a document that brings its own
// geometry keeps it" holds for samples exactly as it does for a drawing you
// saved. This test asserts that, and with LAYOUT_SAMPLES set it writes the
// layout back (`npm run layout-samples`) · run that when the layout engine
// changes enough that the samples look dated.

import { describe, expect, it } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { autoLayoutWithSections } from "../src/engine/layout";
import { migrateSnapshot } from "../src/engine/migrate";
import { NODE_W, NODE_H, ICON_DRAW_W, ICON_DRAW_H } from "../src/canvas/nodeMetrics";
import type { StateSnapshot } from "../src/engine/model";

const SAMPLES = ["api-backend", "media-pipeline", "event-driven", "partner-checkout", "refund-approval"];
const dir = join(__dirname, "..", "samples");
const write = process.env.LAYOUT_SAMPLES;

/** Icon spacing · the view the seed and the Import dialog open in. Press K
 *  and the drawing is re-arranged for cards. */
const OPTS = { nodeW: NODE_W, nodeH: NODE_H, drawW: ICON_DRAW_W, drawH: ICON_DRAW_H };

describe("the samples are already arranged", () => {
  for (const name of SAMPLES) {
    it(`${name}: on disk, positions and frame bounds are what auto-layout would produce`, () => {
      const file = join(dir, `${name}.json`);
      const raw = JSON.parse(readFileSync(file, "utf8")) as StateSnapshot;
      const snap = migrateSnapshot(raw);
      const { positions, frames, sections } = autoLayoutWithSections(
        snap.nodes,
        snap.edges,
        snap.containers,
        OPTS,
      );
      const out = {
        ...raw,
        nodes: snap.nodes.map((n) => ({ ...n, position: positions[n.id] ?? n.position })),
        containers: snap.containers.map((c) => (frames[c.id] ? { ...c, bounds: frames[c.id] } : c)),
        sections: [
          ...snap.sections.filter((x) => !x.id.startsWith("auto-")),
          ...sections.map((x, i) => ({
            id: `auto-${i}`,
            name: x.name,
            color: x.color,
            nodeIds: x.nodeIds,
            collapsed: false,
          })),
        ],
      };
      if (write) {
        writeFileSync(file, `${JSON.stringify(out, null, 2)}\n`);
        return;
      }
      expect(snap.nodes.map((n) => n.position)).toEqual(out.nodes.map((n) => n.position));
      expect(snap.containers.map((c) => c.bounds)).toEqual(out.containers.map((c) => c.bounds));
    });
  }
});
