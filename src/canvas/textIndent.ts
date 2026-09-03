// Indentation for the Import dialog's document box.
//
// The box is where a template is pasted, but it is also where one gets
// typed and repaired, and YAML is whitespace · a plain <textarea> drops the
// caret to column zero on every Enter and eats Tab to the next control,
// which makes hand-editing a template close to impossible. These are the
// three keys that carry the indentation, as pure functions over
// (value, selection) so they can be tested without a DOM.
//
// Nothing here understands YAML or JSON. It carries the previous line's
// indent, opens one level after a line that opened a block, and closes a
// bracket pair onto its own line · which is all an editor does before it
// starts parsing.

export const INDENT = 2;

/** A replacement for the whole field, plus where the caret lands. */
export interface TextEdit {
  value: string;
  selStart: number;
  selEnd: number;
}

const lineStartOf = (value: string, pos: number) => value.lastIndexOf("\n", pos - 1) + 1;
const indentOf = (line: string) => /^[ \t]*/.exec(line)![0];

/** Pairs whose closer goes on its own line when Enter is pressed inside them. */
const PAIRS: Record<string, string> = { "{": "}", "[": "]", "(": ")" };

/** Enter · carry the indent, and open a level after a line that opened one. */
export function onEnter(value: string, selStart: number, selEnd: number): TextEdit {
  const start = lineStartOf(value, selStart);
  const before = value.slice(start, selStart);
  const indent = indentOf(before);
  const head = before.trimEnd();
  const last = head.slice(-1);
  // A YAML key with nothing after it, or an opened bracket, opens a block.
  const opens = last === ":" || last === "-" || last in PAIRS;
  const inner = opens ? indent + " ".repeat(INDENT) : indent;
  const closer = last in PAIRS ? PAIRS[last] : "";
  const after = value.slice(selEnd);
  // Typing Enter between `{` and `}` puts the closer under the block.
  if (closer && after.trimStart().startsWith(closer)) {
    const gap = after.length - after.trimStart().length;
    const caret = selStart + 1 + inner.length;
    return {
      value: `${value.slice(0, selStart)}\n${inner}\n${indent}${after.slice(gap)}`,
      selStart: caret,
      selEnd: caret,
    };
  }
  const caret = selStart + 1 + inner.length;
  return { value: `${value.slice(0, selStart)}\n${inner}${after}`, selStart: caret, selEnd: caret };
}

/** Tab / ⇧Tab · one level in or out, over every line the selection touches. */
export function onTab(value: string, selStart: number, selEnd: number, outdent: boolean): TextEdit {
  const spans = selStart !== selEnd || outdent;
  if (!spans) {
    const col = selStart - lineStartOf(value, selStart);
    const width = INDENT - (col % INDENT) || INDENT;
    const caret = selStart + width;
    return { value: value.slice(0, selStart) + " ".repeat(width) + value.slice(selEnd), selStart: caret, selEnd: caret };
  }
  const start = lineStartOf(value, selStart);
  const endLine = value.indexOf("\n", selEnd);
  const end = endLine === -1 ? value.length : endLine;
  const lines = value.slice(start, end).split("\n");
  let firstDelta = 0;
  let total = 0;
  const shifted = lines.map((line, i) => {
    if (outdent) {
      const cut = /^[ \t]{1,2}/.exec(line)?.[0].length ?? 0;
      if (i === 0) firstDelta = -cut;
      total -= cut;
      return line.slice(cut);
    }
    // A blank line gains nothing · trailing whitespace is not indentation.
    if (!line.length) return line;
    if (i === 0) firstDelta = INDENT;
    total += INDENT;
    return " ".repeat(INDENT) + line;
  });
  return {
    value: value.slice(0, start) + shifted.join("\n") + value.slice(end),
    selStart: Math.max(start, selStart + firstDelta),
    selEnd: Math.max(start, selEnd + total),
  };
}

/** Backspace in the indent of a line · back one level, not one space. */
export function onBackspace(value: string, selStart: number, selEnd: number): TextEdit | null {
  if (selStart !== selEnd) return null;
  const start = lineStartOf(value, selStart);
  const before = value.slice(start, selStart);
  if (!before.length || before.trim().length) return null;
  const col = before.length;
  const width = col % INDENT || INDENT;
  const caret = selStart - width;
  return { value: value.slice(0, caret) + value.slice(selStart), selStart: caret, selEnd: caret };
}
