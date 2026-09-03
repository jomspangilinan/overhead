// Which object the caret is in · the Code panel's half of the two-way
// selection. It works on the text, not on a parse, because the text is
// often mid-edit and a parse would be unavailable exactly when the caret
// is moving.

import { describe, expect, it } from "vitest";
import { lineOf, objectAt, objectRanges } from "../src/canvas/codeRanges";

const doc = JSON.stringify(
  {
    nodes: [
      { id: "api", service: "apigateway", name: "api", settings: { apiType: "HTTP" } },
      { id: "fn", service: "lambda", name: "worker {2}", settings: { memoryMb: 512 } },
    ],
    edges: [{ id: "e1", from: "api", to: "fn", kind: "sync" }],
  },
  null,
  2,
);

const at = (needle: string) => doc.indexOf(needle);

describe("objectRanges", () => {
  it("finds every object that carries an id", () => {
    expect(objectRanges(doc).map((r) => r.id)).toEqual(["api", "fn", "e1"]);
  });

  it("a range spans its own braces and nothing else", () => {
    const fn = objectRanges(doc).find((r) => r.id === "fn")!;
    expect(doc[fn.start]).toBe("{");
    expect(doc[fn.end]).toBe("}");
    expect(doc.slice(fn.start, fn.end + 1)).toContain('"memoryMb": 512');
    expect(doc.slice(fn.start, fn.end + 1)).not.toContain('"api"');
  });

  it("a brace inside a name does not close the object early", () => {
    const fn = objectRanges(doc).find((r) => r.id === "fn")!;
    expect(fn.end).toBeGreaterThan(at('"memoryMb"'));
  });
});

describe("objectAt", () => {
  const ranges = objectRanges(doc);

  it("names the object the caret sits in", () => {
    expect(objectAt(ranges, at('"memoryMb"'))?.id).toBe("fn");
    expect(objectAt(ranges, at('"apiType"'))?.id).toBe("api");
    expect(objectAt(ranges, at('"kind"'))?.id).toBe("e1");
  });

  it("is nothing between objects", () => {
    expect(objectAt(ranges, 0)).toBeNull();
    expect(objectAt(ranges, at('"nodes"'))).toBeNull();
  });

  it("prefers the innermost object when they nest", () => {
    const nested = JSON.stringify({ id: "outer", child: { id: "inner", k: 1 } }, null, 2);
    const r = objectRanges(nested);
    expect(objectAt(r, nested.indexOf('"k"'))?.id).toBe("inner");
    expect(objectAt(r, nested.indexOf('"child"'))?.id).toBe("outer");
  });
});

describe("lineOf", () => {
  it("counts newlines before the offset", () => {
    expect(lineOf("a\nb\nc", 0)).toBe(0);
    expect(lineOf("a\nb\nc", 2)).toBe(1);
    expect(lineOf("a\nb\nc", 4)).toBe(2);
  });
});
