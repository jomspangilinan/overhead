// Which object is the caret inside?
//
// The Code panel is a plain <textarea>, so "the object I am editing" has to
// come from the text itself. Every object in the document carries an `"id"`,
// and ids are unique across the drawing, so one pass finds each id, walks
// back to the `{` that opens its object and forward to the `}` that closes
// it. That range is the object.
//
// String-aware, because a name can contain a brace ("worker {2}") and
// counting those would close the object early. Escapes are honoured for the
// same reason.
//
// Pure and tested · a caret position in, an id out.

export interface ObjectRange {
  id: string;
  /** Character offsets of the object's braces, inclusive of both. */
  start: number;
  end: number;
}

/** Every `"id": "…"` in the text, with the object that holds it.
 *
 *  One forward pass with a stack of open braces. Scanning backwards from an
 *  id cannot work: going that way a `"` is as likely to close a string as to
 *  open one, so the parity is unknowable and every brace inside a name gets
 *  counted. Forwards, string state is never in doubt. */
export function objectRanges(text: string): ObjectRange[] {
  const out: ObjectRange[] = [];
  /** Open objects, innermost last · each may still learn its id. */
  const stack: { start: number; id?: string }[] = [];
  /** The string token just read, and whether the one before it was "id". */
  let lastString: string | null = null;
  let afterIdKey = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      let j = i + 1;
      for (; j < text.length; j++) {
        if (text[j] === "\\") j++;
        else if (text[j] === '"') break;
      }
      const value = text.slice(i + 1, j);
      if (afterIdKey && stack.length) {
        const top = stack[stack.length - 1];
        // The first "id" wins · a nested object states its own.
        if (top.id === undefined) top.id = value;
        afterIdKey = false;
      }
      lastString = value;
      i = j;
      continue;
    }
    if (ch === ":") {
      afterIdKey = lastString === "id";
      continue;
    }
    if (ch === "{") {
      stack.push({ start: i });
      lastString = null;
      afterIdKey = false;
      continue;
    }
    if (ch === "}") {
      const open = stack.pop();
      if (open?.id !== undefined) out.push({ id: open.id, start: open.start, end: i });
      lastString = null;
      afterIdKey = false;
      continue;
    }
    if (ch === "," || ch === "[" || ch === "]") {
      lastString = null;
      afterIdKey = false;
    }
  }
  // Document order reads better than closing order in every use we have.
  return out.sort((a, b) => a.start - b.start);
}

/** The innermost object containing `pos` · null between objects. */
export function objectAt(ranges: ObjectRange[], pos: number): ObjectRange | null {
  let best: ObjectRange | null = null;
  for (const r of ranges) {
    if (pos < r.start || pos > r.end) continue;
    if (!best || r.end - r.start < best.end - best.start) best = r;
  }
  return best;
}

/** 0-based line of a character offset, and of a range · for the gutter. */
export function lineOf(text: string, pos: number): number {
  let line = 0;
  for (let i = 0; i < pos && i < text.length; i++) if (text[i] === "\n") line++;
  return line;
}
