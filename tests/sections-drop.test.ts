// Sections follow the drawing: a node dropped outside a section's box
// leaves it, dropped inside joins it; a section whose members are all
// hidden inside a collapsed container is not drawn.

import { describe, expect, it } from "vitest";
import type { ArchNode, Section } from "../src/engine/model";
import { SECTION_PAD, sectionBoxes, sectionsAfterDrop } from "../src/engine/frames";

const OPTS = { nodeW: 200, nodeH: 100 };
const node = (id: string, x: number, y: number, container?: string): ArchNode => ({ id, service: "lambda", name: id, settings: {}, container, position: { x, y } });
const section = (id: string, nodeIds: string[], bounds?: Section["bounds"]): Section => ({ id, name: id, color: "#fff", nodeIds, collapsed: false, bounds });

describe("sectionsAfterDrop", () => {
  it("drops a member that was dragged clear of the box, keeps one still inside", () => {
    const nodes = [node("a", 100, 100), node("b", 400, 100), node("c", 1000, 1000)];
    const s = section("s", ["a", "b", "c"]);
    // c is far away: the box without c holds a and b only
    expect(sectionsAfterDrop(nodes, [s], "c", OPTS)).toEqual([{ id: "s", nodeIds: ["a", "b"] }]);
    // b sits next to a, well inside the box drawn from a alone plus padding
    expect(sectionsAfterDrop([node("a", 100, 100), node("b", 100 + 100 + SECTION_PAD - 1, 100)], [section("s", ["a", "b"])], "b", OPTS)).toEqual([]);
  });

  it("adds a stranger dropped inside, and never touches groups", () => {
    const nodes = [node("a", 100, 100), node("b", 400, 100), node("x", 250, 100)];
    const s = section("s", ["a", "b"]);
    expect(sectionsAfterDrop(nodes, [s], "x", OPTS)).toEqual([{ id: "s", nodeIds: ["a", "b", "x"] }]);
    const g: Section = { ...section("g", ["a", "b"]), kind: "group" };
    expect(sectionsAfterDrop(nodes, [g], "x", OPTS)).toEqual([]);
  });

  it("keeps the only member of a section with nothing stored (the box would vanish)", () => {
    const nodes = [node("a", 100, 100)];
    expect(sectionsAfterDrop(nodes, [section("s", ["a"])], "a", OPTS)).toEqual([]);
  });

  it("uses stored bounds as the box when they are larger", () => {
    const nodes = [node("a", 100, 100), node("x", 600, 600)];
    const s = section("s", ["a"], { x: 0, y: 0, w: 800, h: 800 });
    expect(sectionsAfterDrop(nodes, [s], "x", OPTS)).toEqual([{ id: "s", nodeIds: ["a", "x"] }]);
  });
});

describe("sectionBoxes with hidden members", () => {
  it("leaves hidden members out and skips a section whose members are all hidden", () => {
    const nodes = [node("a", 100, 100, "vpc"), node("b", 900, 100)];
    const both = section("s", ["a", "b"]);
    const only = section("t", ["a"], { x: 0, y: 0, w: 400, h: 300 });
    const hidden = new Set(["a"]);
    const boxes = sectionBoxes(nodes, [both, only], { ...OPTS, hidden });
    expect(boxes.get("s")!.l).toBe(900 - 100 - SECTION_PAD);
    expect(boxes.has("t")).toBe(false);
  });
});
