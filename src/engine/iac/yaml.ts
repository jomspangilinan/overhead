// The YAML CloudFormation is actually written in, both directions.
//
// A dependency was not worth it for the subset a template uses: block
// mappings and sequences, scalars, flow collections only when empty, and
// the short-form intrinsics (!Ref, !GetAtt, !Sub …) that are the reason a
// JSON parser cannot read a hand-written template in the first place.
// Everything here is pure TS and round-trip tested against our own output.

export type Yaml = unknown;

// ── writing ───────────────────────────────────────────────────────────────

const PLAIN = /^[A-Za-z][A-Za-z0-9 _.\-/:]*$/;
const RESERVED = /^(y|Y|yes|Yes|YES|n|N|no|No|NO|true|True|TRUE|false|False|FALSE|on|On|ON|off|Off|OFF|null|Null|NULL|~)$/;

function scalar(value: string): string {
  if (!value) return '""';
  // A plain scalar may not start a sequence, hold ": ", or read as a
  // number or a boolean · anything doubtful is quoted.
  if (!PLAIN.test(value) || RESERVED.test(value) || value.includes(": ") || value.endsWith(":")) {
    return JSON.stringify(value);
  }
  return value;
}

function key(k: string): string {
  return /^[A-Za-z0-9_-]+$/.test(k) ? k : JSON.stringify(k);
}

/** Block YAML, two-space indents, keys in insertion order. */
export function toYaml(value: Yaml, indent = 0): string {
  const pad = " ".repeat(indent);
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (typeof value === "string") return scalar(value);
  if (Array.isArray(value)) {
    if (!value.length) return "[]";
    // A block item starts on the dash line · "- " is exactly the two
    // columns the nested block was already indented by, so the first row
    // moves up beside the dash and the rest stay where they are.
    const rows = value.map((item) => {
      const body = toYaml(item, indent + 2);
      if (!body.startsWith("\n")) return `${pad}- ${body}`;
      const [first, ...rest] = body.slice(1).split("\n");
      return [`${pad}- ${first.trimStart()}`, ...rest].join("\n");
    });
    return "\n" + rows.join("\n");
  }
  const entries = Object.entries(value as Record<string, Yaml>).filter(([, v]) => v !== undefined);
  if (!entries.length) return "{}";
  const rows = entries.map(([k, v]) => {
    const body = toYaml(v, indent + 2);
    return body.startsWith("\n") ? `${pad}${key(k)}:${body}` : `${pad}${key(k)}: ${body}`;
  });
  return "\n" + rows.join("\n");
}

/** A whole document · the top level carries no leading blank line. */
export function toYamlDocument(value: Yaml): string {
  return toYaml(value).replace(/^\n/, "") + "\n";
}

// ── reading ───────────────────────────────────────────────────────────────

interface Line {
  indent: number;
  text: string;
  /** This line opened a sequence item ("- " was stripped). */
  seq: boolean;
}

/** Strip a trailing comment that is outside quotes. */
function uncomment(raw: string): string {
  let quote: string | null = null;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === "#" && (i === 0 || /\s/.test(raw[i - 1]))) return raw.slice(0, i);
  }
  return raw;
}

function lines(source: string): Line[] {
  const out: Line[] = [];
  for (const raw of source.replace(/\r\n?/g, "\n").split("\n")) {
    const stripped = uncomment(raw);
    if (!stripped.trim() || stripped.trim() === "---") continue;
    let indent = stripped.length - stripped.trimStart().length;
    let text = stripped.trim();
    let seq = false;
    // "- key: value" is one sequence item whose body starts under the dash
    if (text === "-" || text.startsWith("- ")) {
      seq = true;
      const rest = text === "-" ? "" : text.slice(2);
      indent += text.length - rest.length;
      text = rest;
    }
    out.push({ indent, text, seq });
  }
  return out;
}

/** !Ref x · !GetAtt a.b · !Sub "…" · !If [...] — the short forms a JSON
 *  parser cannot see, mapped onto the long forms the rest of the code reads. */
function shortTag(text: string): Yaml | undefined {
  const m = /^!([A-Za-z:]+)\s*(.*)$/.exec(text);
  if (!m) return undefined;
  const [, tag, rest] = m;
  const body = rest.trim();
  if (tag === "Ref") return { Ref: unquote(body) };
  if (tag === "Condition") return { Condition: unquote(body) };
  if (tag === "GetAtt") {
    const parts = body.startsWith("[") ? (flow(body) as string[]) : unquote(body).split(".");
    return { "Fn::GetAtt": parts };
  }
  return { [`Fn::${tag}`]: body.startsWith("[") || body.startsWith("{") ? flow(body) : unquote(body) };
}

function unquote(text: string): string {
  const t = text.trim();
  if (t.length >= 2 && t[0] === '"' && t.endsWith('"')) {
    try {
      return JSON.parse(t) as string;
    } catch {
      return t.slice(1, -1);
    }
  }
  if (t.length >= 2 && t[0] === "'" && t.endsWith("'")) return t.slice(1, -1).replace(/''/g, "'");
  return t;
}

/** Flow collections · [a, b] and {a: b}, one level of nesting. */
function flow(text: string): Yaml {
  const t = text.trim();
  if (t === "[]") return [];
  if (t === "{}") return {};
  try {
    return JSON.parse(t) as Yaml;
  } catch {
    /* not JSON-shaped · fall through to a hand split */
  }
  if (t.startsWith("[") && t.endsWith("]")) {
    return splitTop(t.slice(1, -1)).map((p) => plainScalar(p));
  }
  if (t.startsWith("{") && t.endsWith("}")) {
    const out: Record<string, Yaml> = {};
    for (const part of splitTop(t.slice(1, -1))) {
      const i = part.indexOf(":");
      if (i < 0) continue;
      out[unquote(part.slice(0, i))] = plainScalar(part.slice(i + 1));
    }
    return out;
  }
  return plainScalar(t);
}

function splitTop(body: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    else if (c === "[" || c === "{") depth++;
    else if (c === "]" || c === "}") depth--;
    else if (c === "," && depth === 0) {
      out.push(body.slice(start, i));
      start = i + 1;
    }
  }
  if (body.slice(start).trim()) out.push(body.slice(start));
  return out.map((p) => p.trim()).filter(Boolean);
}

function plainScalar(text: string): Yaml {
  const t = text.trim();
  if (!t) return null;
  const tagged = shortTag(t);
  if (tagged !== undefined) return tagged;
  if (t[0] === '"' || t[0] === "'") return unquote(t);
  if (t === "null" || t === "~") return null;
  if (t === "true" || t === "True") return true;
  if (t === "false" || t === "False") return false;
  if (/^-?\d+$/.test(t) || /^-?\d*\.\d+$/.test(t)) return Number(t);
  if (t.startsWith("[") || t.startsWith("{")) return flow(t);
  return t;
}

/** The lines from `at` that belong to the block starting there. */
function blockEnd(ls: Line[], at: number, indent: number): number {
  let i = at;
  while (i < ls.length && ls[i].indent > indent) i++;
  return i;
}

/** A sequence item runs until the next dash at its own column · the keys
 *  after "- Key: value" sit at that same column without a dash, so the
 *  plain deeper-than test would have ended the item after one line. */
function itemEnd(ls: Line[], at: number, indent: number): number {
  let i = at;
  while (i < ls.length && (ls[i].indent > indent || (ls[i].indent === indent && !ls[i].seq))) i++;
  return i;
}

function parseBlock(ls: Line[], from: number, to: number): Yaml {
  if (from >= to) return null;
  const indent = ls[from].indent;
  if (ls[from].seq) {
    const items: Yaml[] = [];
    let i = from;
    while (i < to && ls[i].indent === indent && ls[i].seq) {
      const end = Math.min(to, itemEnd(ls, i + 1, indent));
      items.push(parseEntry(ls, i, end, indent));
      i = end;
    }
    return items;
  }
  const map: Record<string, Yaml> = {};
  let i = from;
  while (i < to && ls[i].indent === indent && !ls[i].seq) {
    const end = blockEnd(ls, i + 1, indent);
    const { k, v } = parseMapping(ls, i, end, indent);
    if (k !== null) map[k] = v;
    i = end;
  }
  return map;
}

/** One sequence item: a scalar on the dash line, or a block under it. */
function parseEntry(ls: Line[], at: number, end: number, indent: number): Yaml {
  const line = ls[at];
  if (!line.text) return at + 1 < end ? parseBlock(ls, at + 1, end) : null;
  if (splitKey(line.text) === null) {
    return line.text.endsWith(":") || at + 1 >= end ? plainScalar(line.text) : plainScalar(line.text);
  }
  // "- Key: Name" · the item is a mapping that starts on this line
  const map: Record<string, Yaml> = {};
  let i = at;
  while (i < end && ls[i].indent === indent && (i === at || !ls[i].seq)) {
    const stop = blockEnd(ls, i + 1, indent);
    const { k, v } = parseMapping(ls, i, stop, indent);
    if (k !== null) map[k] = v;
    i = stop;
  }
  return map;
}

/** The colon that separates a key, ignoring quotes and "::" in a tag. */
function splitKey(text: string): number | null {
  let quote: string | null = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    else if (c === "[" || c === "{") return null;
    else if (c === ":" && (i + 1 === text.length || text[i + 1] === " ")) return i;
  }
  return null;
}

function parseMapping(ls: Line[], at: number, end: number, indent: number): { k: string | null; v: Yaml } {
  const line = ls[at];
  const cut = splitKey(line.text);
  if (cut === null) return { k: null, v: null };
  const k = unquote(line.text.slice(0, cut));
  const rest = line.text.slice(cut + 1).trim();
  if (rest === "|" || rest === ">" || rest === "|-" || rest === ">-") {
    const body = ls.slice(at + 1, end).map((l) => " ".repeat(l.indent - indent - 2) + l.text);
    return { k, v: rest[0] === ">" ? body.join(" ") : body.join("\n") };
  }
  if (rest) return { k, v: plainScalar(rest) };
  return { k, v: at + 1 < end ? parseBlock(ls, at + 1, end) : null };
}

export function parseYaml(source: string): Yaml {
  const ls = lines(source);
  return parseBlock(ls, 0, ls.length);
}
