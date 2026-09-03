// A drawing in a link · the "visualise my architecture" path without a file.
// The encoding is deliberately boring (base64url of UTF-8) so any agent can
// build one in a line, in any language, without matching our encoder.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { decodeDoc, encodeDoc, linkFor, pack, packedLinkFor, parseImportLink, readImportLink, unpack } from "../src/engine/iac/share";
import { importAny } from "../src/engine/iac/import";
import { migrateSnapshot } from "../src/engine/migrate";
import type { StateSnapshot } from "../src/engine/model";

const sample = (name: string): StateSnapshot =>
  migrateSnapshot(JSON.parse(readFileSync(join(__dirname, "..", "samples", `${name}.json`), "utf8")));

describe("the encoding", () => {
  it("round-trips, and is URL-safe", () => {
    const text = '{"nodes":[{"name":"café · ingest/api?x=1&y=2"}]}';
    const encoded = encodeDoc(text);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeDoc(encoded)).toBe(text);
  });

  it("refuses what is not base64url, rather than returning mojibake", () => {
    expect(decodeDoc("not base64!")).toBeNull();
    expect(decodeDoc("////")).toBeNull();
  });
});

describe("parsing a link", () => {
  it("reads a document out of the fragment", () => {
    const doc = JSON.stringify(sample("api-backend"));
    const link = parseImportLink(linkFor(doc, "https://overhead-ecru.vercel.app"));
    expect(link).toEqual({ kind: "doc", text: doc });
  });

  it("what comes out of a link is what the Import dialog reads", () => {
    const doc = JSON.stringify(sample("event-driven"));
    const link = parseImportLink(linkFor(doc, "https://overhead-ecru.vercel.app"));
    if (link?.kind !== "doc") throw new Error("not a doc link");
    const read = importAny(link.text);
    expect(read.ok).toBe(true);
    if (read.ok) expect(read.snapshot.nodes).toHaveLength(8);
  });

  it("takes an https template address", () => {
    const url = "https://raw.githubusercontent.com/acme/infra/main/template.yaml";
    expect(parseImportLink(`https://overhead.app/#template=${encodeURIComponent(url)}`)).toEqual({
      kind: "template",
      url,
    });
  });

  it("refuses a template address that is not https", () => {
    for (const bad of ["http://example.com/t.yaml", "file:///etc/passwd", "javascript:alert(1)"]) {
      const link = parseImportLink(`https://overhead.app/#template=${encodeURIComponent(bad)}`);
      expect(link?.kind, bad).toBe("error");
    }
  });

  it("falls back to the query string, because some tools eat fragments", () => {
    const doc = '{"nodes":[]}';
    const link = parseImportLink(`https://overhead.app/?doc=${encodeDoc(doc)}`);
    expect(link).toEqual({ kind: "doc", text: doc });
  });

  it("is nothing when the link asks for nothing", () => {
    expect(parseImportLink("https://overhead.app/")).toBeNull();
    expect(parseImportLink("https://overhead.app/#zoom=2")).toBeNull();
    expect(parseImportLink("not a url")).toBeNull();
  });

  it("says so instead of throwing when the fragment is rubbish", () => {
    const link = parseImportLink("https://overhead.app/#doc=%%%not-base64%%%");
    expect(link?.kind).toBe("error");
  });
});

// Compression is what makes a link pasteable: a real drawing is a 5K URL
// plain and a 1K URL packed. `#doc=` stays for anybody building one by hand.
describe("packing", () => {
  const doc = JSON.stringify(sample("event-driven"));

  it("round-trips", async () => {
    const packed = await pack(doc);
    expect(packed).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(await unpack(packed!)).toBe(doc);
  });

  it("is worth doing · the link is several times shorter", async () => {
    const plain = linkFor(doc, "https://overhead.app");
    const short = await packedLinkFor(doc, "https://overhead.app");
    expect(short.length).toBeLessThan(plain.length / 2);
  });

  it("reads back through the same door as a plain link", async () => {
    const link = await readImportLink(await packedLinkFor(doc, "https://overhead.app"));
    expect(link).toEqual({ kind: "doc", text: doc });
  });

  it("says so when the packing is corrupt, rather than throwing", async () => {
    const link = await readImportLink("https://overhead.app/#p=bm90LWRlZmxhdGVk");
    expect(link?.kind).toBe("error");
  });

  it("leaves a plain link alone", async () => {
    const link = await readImportLink(linkFor('{"nodes":[]}', "https://overhead.app"));
    expect(link).toEqual({ kind: "doc", text: '{"nodes":[]}' });
  });
});
