// The flow shapes are drawn once and served as files.
//
// `engine/services/flowShapes.ts` is the drawing; the canvas injects it as
// `<symbol>`s and `public/icons/flow/<id>.svg` holds the same six for anyone
// reading an exported Mermaid document, which links to them exactly as it
// links to the official AWS icons. Two copies of a picture drift, so this
// asserts they match · and with WRITE_FLOW_ICONS set it writes them, which
// is `npm run flow-icons`.

import { describe, expect, it } from "vitest";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { FLOW_SHAPES, flowIconFile } from "../src/engine/services/flowShapes";
import { ICON_FILE } from "../src/engine/services/iconFiles";

const dir = join(__dirname, "..", "public", "icons", "flow");
const write = process.env.WRITE_FLOW_ICONS;

describe("the flow shapes on disk", () => {
  for (const id of Object.keys(FLOW_SHAPES)) {
    it(`${id}.svg is the drawing in flowShapes.ts`, () => {
      const file = join(dir, `${id}.svg`);
      const want = flowIconFile(id) + "\n";
      if (write) {
        writeFileSync(file, want);
        return;
      }
      expect(existsSync(file), `${id}.svg is missing · run npm run flow-icons`).toBe(true);
      expect(readFileSync(file, "utf8")).toBe(want);
    });
  }

  it("every shape is linked from the icon map, so an export can find it", () => {
    for (const id of Object.keys(FLOW_SHAPES)) {
      expect(ICON_FILE[id as keyof typeof ICON_FILE], id).toBe(`icons/flow/${id}.svg`);
    }
  });
});
