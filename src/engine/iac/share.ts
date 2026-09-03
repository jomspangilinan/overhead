// A drawing in a link.
//
// This is the "visualise my architecture" path, minus the file. A coding
// agent has your repo and can synthesise a template out of it, but it cannot
// call this page's tools · it is not the agent holding the browser. What it
// *can* do is hand you a URL, and a URL needs no backend, no upload and no
// account. You click it, the drawing is there, priced, with the diff shown
// before anything replaces what you already had.
//
// Three shapes, because an agent should not have to think about which:
//
//   #doc=<base64url>      the document itself · our JSON, a CloudFormation
//                         template, a CDK stack we wrote. Anything the
//                         Import dialog reads, `detectFormat` decides which.
//   #p=<base64url>        the same thing deflated first. Five times shorter
//                         on a real drawing (5,407 characters of link became
//                         1,057), which is the difference between a URL you
//                         can paste in a chat and one that gets mangled.
//                         This is what `share_link` produces.
//   #template=<https url> fetch it from where it already lives (a raw file
//                         in a repo). Nothing is uploaded · the browser
//                         fetches it the way it would any link you clicked.
//
// Both encodings are read, and `#doc=` is kept deliberately: an agent that
// has your repo should be able to build a link in one line of any language
// without matching our compressor. Short is our job, not theirs.
//
// The hash, not the query string, so the architecture never reaches a server
// log · a fragment is not sent with the request. The query string is read as
// a fallback because some tools mangle fragments, and that is a worse
// failure than a logged URL.
//
// Plain base64url of UTF-8, not a compressed format: any agent can produce
// it in one line, in any language, without matching our encoder. That is
// worth more than a shorter URL.

/** What a link asks us to open. */
export type ImportLink =
  | { kind: "doc"; text: string }
  /** Deflated · `unpack()` turns it into a `doc`, or `readImportLink` does. */
  | { kind: "packed"; value: string }
  | { kind: "template"; url: string }
  | { kind: "error"; message: string };

const B64URL = /^[A-Za-z0-9_-]+={0,2}$/;

/** Text → the value that goes after `#doc=`. */
export function encodeDoc(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** …and back. Returns null when it is not base64url or not UTF-8. */
export function decodeDoc(value: string): string | null {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  if (!B64URL.test(value)) return null;
  try {
    const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/** The whole link for a document, uncompressed · the shape anyone can build. */
export function linkFor(text: string, origin: string): string {
  return `${origin.replace(/\/+$/, "")}/#doc=${encodeDoc(text)}`;
}

/** Deflate, where the platform has it (every browser we target, and Node
 *  18+). Falls back to the plain link rather than failing · a long link
 *  still works. */
export async function packedLinkFor(text: string, origin: string): Promise<string> {
  const packed = await pack(text);
  return packed
    ? `${origin.replace(/\/+$/, "")}/#p=${packed}`
    : linkFor(text, origin);
}

const streams = () =>
  typeof CompressionStream !== "undefined" && typeof DecompressionStream !== "undefined";

async function through(stream: CompressionStream | DecompressionStream, bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  const writer = stream.writable.getWriter();
  // Both sides of a failed inflate reject · the read side is the one we
  // report, so the write side has to be caught or it surfaces as an
  // unhandled rejection whenever somebody hands us a corrupt link.
  const ignore = () => {};
  writer.write(bytes).catch(ignore);
  writer.close().catch(ignore);
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}

const toB64Url = (bytes: Uint8Array) => {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

/** Text → the value after `#p=` · null when the platform cannot deflate. */
export async function pack(text: string): Promise<string | null> {
  if (!streams()) return null;
  try {
    const out = await through(new CompressionStream("deflate-raw"), new TextEncoder().encode(text) as Uint8Array<ArrayBuffer>);
    return toB64Url(out);
  } catch {
    return null;
  }
}

/** …and back. Null when it is not our packing, rather than a throw. */
export async function unpack(value: string): Promise<string | null> {
  if (!streams() || !B64URL.test(value)) return null;
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  try {
    const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0)) as Uint8Array<ArrayBuffer>;
    const out = await through(new DecompressionStream("deflate-raw"), bytes);
    return new TextDecoder("utf-8", { fatal: true }).decode(out);
  } catch {
    return null;
  }
}

/** A drawing arriving by link is a document from a stranger, so the size cap
 *  is here and not only at the fetch: a 40 MB fragment should be refused
 *  before it is decoded, not after. */
const MAX_DOC = 512 * 1024;

/** Read `#doc=` / `#template=` out of a URL · the query string as a
 *  fallback. Returns null when the link asks for nothing. */
export function parseImportLink(url: string): ImportLink | null {
  let params: URLSearchParams;
  try {
    const parsed = new URL(url);
    const hash = parsed.hash.startsWith("#") ? parsed.hash.slice(1) : parsed.hash;
    params = new URLSearchParams(hash);
    // Every shape has to be listed here · a fragment carrying only `p`
    // used to fall through to an empty query string and read as "no link".
    if (!["doc", "p", "template"].some((k) => params.has(k))) params = parsed.searchParams;
  } catch {
    return null;
  }

  const template = params.get("template");
  if (template) {
    let target: URL;
    try {
      target = new URL(template);
    } catch {
      return { kind: "error", message: "That link's template address is not a URL." };
    }
    // https only · a link that could make the page fetch over http, or read a
    // file:// path, is not something to accept from a stranger's URL.
    if (target.protocol !== "https:") {
      return { kind: "error", message: "A linked template has to be an https address." };
    }
    return { kind: "template", url: target.toString() };
  }

  const packed = params.get("p");
  if (packed) {
    if (packed.length > MAX_DOC) return { kind: "error", message: "That link carries too much to read." };
    return { kind: "packed", value: packed };
  }

  const doc = params.get("doc");
  if (!doc) return null;
  if (doc.length > MAX_DOC) return { kind: "error", message: "That link carries too much to read." };
  const text = decodeDoc(doc);
  if (text === null) return { kind: "error", message: "That link's document could not be decoded." };
  return { kind: "doc", text };
}

/** `parseImportLink`, with a packed document already inflated · what the app
 *  calls. Kept apart from the parser so the parser stays synchronous and
 *  testable without a platform stream. */
export async function readImportLink(url: string): Promise<ImportLink | null> {
  const link = parseImportLink(url);
  if (link?.kind !== "packed") return link;
  const text = await unpack(link.value);
  return text === null
    ? { kind: "error", message: "That link's document could not be unpacked." }
    : { kind: "doc", text };
}
