import { describe, expect, it } from "vitest";
import { onBackspace, onEnter, onTab } from "../src/canvas/textIndent";

/** Where the caret sits, written as | in the expected string. */
const shown = (e: { value: string; selStart: number; selEnd: number }) =>
  `${e.value.slice(0, e.selStart)}|${e.value.slice(e.selEnd)}`;

describe("Enter", () => {
  it("carries the line's indent", () => {
    const v = "Resources:\n  Fn:\n    Type: AWS::Lambda::Function";
    expect(shown(onEnter(v, v.length, v.length))).toBe(`${v}\n    |`);
  });

  it("opens a level after a YAML key", () => {
    const v = "Resources:";
    expect(shown(onEnter(v, v.length, v.length))).toBe("Resources:\n  |");
  });

  it("opens a level after a list dash", () => {
    const v = "  Subnets:\n    -";
    expect(shown(onEnter(v, v.length, v.length))).toBe("  Subnets:\n    -\n      |");
  });

  it("puts a closing bracket on its own line", () => {
    const v = '{"Resources": {}}';
    const at = v.indexOf("{}") + 1;
    expect(shown(onEnter(v, at, at))).toBe('{"Resources": {\n  |\n}}');
  });

  it("replaces the selection", () => {
    const v = "  a: 1";
    expect(shown(onEnter(v, 2, 6))).toBe("  \n  |");
  });
});

describe("Tab", () => {
  it("inserts to the next stop, not a fixed two", () => {
    expect(shown(onTab("abc", 3, 3, false))).toBe("abc |");
    expect(shown(onTab("ab", 2, 2, false))).toBe("ab  |");
  });

  it("indents every line the selection touches", () => {
    const v = "a\nb\nc";
    const e = onTab(v, 0, 3, false);
    expect(e.value).toBe("  a\n  b\nc");
  });

  it("outdents by one level and never past column zero", () => {
    const v = "    a\n  b";
    expect(onTab(v, 0, v.length, true).value).toBe("  a\nb");
    expect(onTab("a", 0, 1, true).value).toBe("a");
  });

  it("leaves blank lines alone", () => {
    expect(onTab("a\n\nb", 0, 4, false).value).toBe("  a\n\n  b");
  });
});

describe("Backspace", () => {
  it("goes back a level inside the indent", () => {
    expect(shown(onBackspace("    ", 4, 4)!)).toBe("  |");
  });

  it("does nothing once there is text on the line", () => {
    expect(onBackspace("  a", 3, 3)).toBeNull();
    expect(onBackspace("", 0, 0)).toBeNull();
  });
});
