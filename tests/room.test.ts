// A room moves patches, not drawings · the same patches the agent sends.
// These are the two pure halves: what goes on the wire (`diffSnapshots`) and
// what is allowed off it (`parseMessage`).

import { describe, expect, it } from "vitest";
import { applyPatch, diffSnapshots } from "../src/engine/patch";
import { parseMessage, ROOM_ID, MAX_MESSAGE, MAX_PEERS, ROOM_TTL_MS, type ServerMessage } from "../src/net/protocol";
import { Relay } from "../src/net/relay";
import { DEFAULT_TRAFFIC, type StateSnapshot } from "../src/engine/model";

const base = (): StateSnapshot => ({
  nodes: [
    { id: "api", service: "apigateway", name: "api", settings: { apiType: "HTTP" }, position: { x: 0, y: 0 } },
    { id: "fn", service: "lambda", name: "fn", settings: { memoryMb: 512 }, position: { x: 240, y: 0 } },
  ],
  edges: [{ id: "e1", from: "api", to: "fn", kind: "sync" }],
  containers: [],
  sections: [],
  traffic: DEFAULT_TRAFFIC,
});

const ok = (r: ReturnType<typeof applyPatch>) => {
  if (!r.ok) throw new Error(r.message);
  return r.snapshot;
};

describe("what goes on the wire", () => {
  it("says nothing when nothing moved", () => {
    expect(diffSnapshots(base(), base())).toBeNull();
  });

  it("carries only what changed", () => {
    const next = base();
    next.nodes[1] = { ...next.nodes[1], position: { x: 400, y: 120 } };
    const patch = diffSnapshots(base(), next)!;
    expect(Object.keys(patch)).toEqual(["nodes"]);
    expect(patch.nodes).toHaveLength(1);
    expect((patch.nodes![0] as { id: string }).id).toBe("fn");
  });

  it("carries a deletion as a removal", () => {
    const next = base();
    next.nodes = next.nodes.filter((n) => n.id !== "fn");
    next.edges = [];
    expect(diffSnapshots(base(), next)!.remove).toEqual(["fn", "e1"]);
  });

  // The round trip is the whole claim: what I send, applied on your machine,
  // gives your machine my drawing.
  it("applied on the other side, reproduces the change", () => {
    const mine = base();
    const moved = base();
    moved.nodes[0] = { ...moved.nodes[0], name: "orders-api", settings: { apiType: "REST" } };
    const patch = diffSnapshots(mine, moved)!;
    const yours = ok(applyPatch(base(), patch));
    expect(yours.nodes[0].name).toBe("orders-api");
    expect(yours.nodes[0].settings.apiType).toBe("REST");
  });

  it("two people touching different resources both land", () => {
    const start = base();
    const a = base();
    a.nodes[0] = { ...a.nodes[0], name: "renamed-by-a" };
    const b = base();
    b.nodes[1] = { ...b.nodes[1], position: { x: 900, y: 300 } };
    // each sends a patch against the state they both had
    let merged = ok(applyPatch(start, diffSnapshots(start, a)!));
    merged = ok(applyPatch(merged, diffSnapshots(start, b)!));
    expect(merged.nodes[0].name).toBe("renamed-by-a");
    expect(merged.nodes[1].position).toEqual({ x: 900, y: 300 });
  });
});

describe("what is allowed off the wire", () => {
  it("takes the four message kinds", () => {
    expect(parseMessage(JSON.stringify({ t: "need" }))).toEqual({ t: "need" });
    expect(parseMessage(JSON.stringify({ t: "patch", patch: { nodes: [] } }))).toEqual({
      t: "patch",
      patch: { nodes: [] },
    });
    expect(parseMessage(JSON.stringify({ t: "here", selected: "fn" }))).toEqual({ t: "here", selected: "fn" });
    expect(parseMessage(JSON.stringify({ t: "state", snapshot: base() }))?.t).toBe("state");
  });

  it("refuses everything else, including a well-formed lie", () => {
    for (const bad of [
      "not json",
      JSON.stringify(["patch"]),
      JSON.stringify({ t: "patch" }),
      JSON.stringify({ t: "patch", patch: "drop tables" }),
      JSON.stringify({ t: "state", snapshot: { nodes: "no" } }),
      JSON.stringify({ t: "eval", code: "1" }),
      JSON.stringify(null),
    ]) {
      expect(parseMessage(bad), bad).toBeNull();
    }
    expect(parseMessage(123)).toBeNull();
  });

  it("refuses a message past the cap before parsing it", () => {
    expect(parseMessage(`{"t":"need","x":"${"a".repeat(MAX_MESSAGE)}"}`)).toBeNull();
  });

  it("trims a name rather than trusting its length", () => {
    const m = parseMessage(JSON.stringify({ t: "here", name: "x".repeat(500) }));
    expect((m as { name: string }).name.length).toBe(24);
  });

  it("room ids are what the relay will accept", () => {
    expect(ROOM_ID.test("abc123def456")).toBe(true);
    expect(ROOM_ID.test("../etc/passwd")).toBe(false);
    expect(ROOM_ID.test("ABC123")).toBe(false);
    expect(ROOM_ID.test("short")).toBe(false);
  });
});

// The relay's rules, without a socket · this is the object both the Vercel
// function and the local dev server drive, so testing it here tests both.
describe("the relay", () => {
  const spy = () => {
    const seen: ServerMessage[] = [];
    return { seen, send: (m: ServerMessage) => seen.push(m) };
  };

  it("tells a newcomer who is here, and tells them somebody arrived", () => {
    const relay = new Relay();
    const a = spy();
    const first = relay.join("room123456", "aaa", a.send)!;
    expect(a.seen).toEqual([{ t: "welcome", me: "aaa", peers: [] }]);
    const b = spy();
    relay.join("room123456", "bbb", b.send);
    expect(b.seen[0]).toEqual({ t: "welcome", me: "bbb", peers: [{ id: "aaa", host: true }] });
    expect(a.seen[1]).toEqual({ t: "joined", peer: { id: "bbb" } });
    expect(first.id).toBe("aaa");
  });

  it("forwards to the others and never back to the sender", () => {
    const relay = new Relay();
    const a = spy();
    const b = spy();
    const c = spy();
    const A = relay.join("room123456", "aaa", a.send)!;
    relay.join("room123456", "bbb", b.send);
    relay.join("room123456", "ccc", c.send);
    const before = a.seen.length;
    relay.message("room123456", A, JSON.stringify({ t: "cursor", x: 5, y: 6 }));
    expect(a.seen.length).toBe(before);
    expect(b.seen.at(-1)).toEqual({ t: "cursor", x: 5, y: 6, from: "aaa" });
    expect(c.seen.at(-1)).toEqual({ t: "cursor", x: 5, y: 6, from: "aaa" });
  });

  it("drops a message that is not one of ours, without disconnecting anybody", () => {
    const relay = new Relay();
    const a = spy();
    const b = spy();
    const A = relay.join("room123456", "aaa", a.send)!;
    relay.join("room123456", "bbb", b.send);
    const before = b.seen.length;
    for (const junk of ["not json", JSON.stringify({ t: "drop-tables" }), "x".repeat(70_000)]) {
      relay.message("room123456", A, junk);
    }
    expect(b.seen.length).toBe(before);
  });

  it("remembers presence, so a late arrival is told who is where", () => {
    const relay = new Relay();
    const a = spy();
    const A = relay.join("room123456", "aaa", a.send)!;
    relay.message("room123456", A, JSON.stringify({ t: "here", name: "Jo", selected: "fn" }));
    const b = spy();
    relay.join("room123456", "bbb", b.send);
    expect(b.seen[0]).toEqual({
      t: "welcome",
      me: "bbb",
      peers: [{ id: "aaa", host: true, name: "Jo", selected: "fn" }],
    });
  });

  it("says when a room is full instead of quietly dropping the eighth", () => {
    const relay = new Relay();
    for (let i = 0; i < MAX_PEERS; i++) relay.join("room123456", `p${i}`, () => {});
    const late = spy();
    expect(relay.join("room123456", "late", late.send)).toBeNull();
    expect(late.seen[0]).toMatchObject({ t: "full" });
  });

  it("expires · a room stops taking people once it is old", () => {
    let now = 0;
    const relay = new Relay(() => now);
    relay.join("room123456", "aaa", () => {});
    now += ROOM_TTL_MS + 1;
    const late = spy();
    expect(relay.join("room123456", "late", late.send)).toBeNull();
    expect(late.seen[0]).toMatchObject({ t: "expired" });
  });

  it("tells the room when somebody leaves", () => {
    const relay = new Relay();
    const a = spy();
    const b = spy();
    relay.join("room123456", "aaa", a.send);
    const B = relay.join("room123456", "bbb", b.send)!;
    // the host leaving is a different thing entirely · see "the host" below
    relay.leave("room123456", B);
    expect(a.seen.at(-1)).toEqual({ t: "left", id: "bbb" });
  });
});

// A room is somebody's sitting, not a place · when the person who started it
// leaves, it ends for everyone rather than lingering with whoever still has
// the tab open.
describe("the host", () => {
  const spy = () => {
    const seen: ServerMessage[] = [];
    return { seen, send: (m: ServerMessage) => seen.push(m) };
  };

  it("is the first one in, and everybody can see who", () => {
    const relay = new Relay();
    const a = spy();
    relay.join("hostroom123", "aaa", a.send);
    const b = spy();
    relay.join("hostroom123", "bbb", b.send);
    expect(b.seen[0]).toMatchObject({ peers: [{ id: "aaa", host: true }] });
    expect(a.seen[1]).toEqual({ t: "joined", peer: { id: "bbb" } });
  });

  it("leaving closes the room for the others", () => {
    const relay = new Relay();
    const a = spy();
    const b = spy();
    const A = relay.join("hostroom123", "aaa", a.send)!;
    relay.join("hostroom123", "bbb", b.send);
    relay.leave("hostroom123", A);
    expect(b.seen.at(-1)).toMatchObject({ t: "closed" });
  });

  it("and the id is spent · a reconnect does not reopen it", () => {
    const relay = new Relay();
    const a = spy();
    const A = relay.join("hostroom123", "aaa", a.send)!;
    relay.join("hostroom123", "bbb", () => {});
    relay.leave("hostroom123", A);
    const back = spy();
    expect(relay.join("hostroom123", "bbb-again", back.send)).toBeNull();
    expect(back.seen[0]).toMatchObject({ t: "expired" });
  });

  it("a guest leaving changes nothing for anyone else", () => {
    const relay = new Relay();
    const a = spy();
    const b = spy();
    relay.join("hostroom123", "aaa", a.send);
    const B = relay.join("hostroom123", "bbb", b.send)!;
    relay.leave("hostroom123", B);
    expect(a.seen.at(-1)).toEqual({ t: "left", id: "bbb" });
    const c = spy();
    expect(relay.join("hostroom123", "ccc", c.send)).not.toBeNull();
  });

  it("a spent id is forgotten again once it is older than a room's life", () => {
    let now = 0;
    const relay = new Relay(() => now);
    const A = relay.join("hostroom123", "aaa", () => {})!;
    relay.leave("hostroom123", A);
    now += ROOM_TTL_MS + 1;
    const fresh = spy();
    expect(relay.join("hostroom123", "new", fresh.send)).not.toBeNull();
    expect(fresh.seen[0]).toMatchObject({ t: "welcome" });
  });
});
