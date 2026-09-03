// What a room says to itself.
//
// Two humans and their agents on one URL. The unit of collaboration is the
// same one the agent already uses: a **patch addressed by id**
// (`engine/patch.ts`). That is not a coincidence · ids were chosen over array
// indices because an agent's copy of the state goes stale the moment a human
// drags something, and that is exactly the property that makes two people
// editing at once merge instead of clobber. Disjoint edits commute; the same
// field edited twice in the same instant is last-writer-wins, which is honest
// for v1 and is the only case a CRDT would do better.
//
// The relay is dumb on purpose: it never parses a drawing, never stores one,
// and never sends anything back to the sender. Everything it knows is a room
// id, who is in it, and how big a message is allowed to be.

import type { StatePatch } from "../engine/patch";
import type { StateSnapshot } from "../engine/model";

/** Room ids are made by the browser, not the server · nothing to enumerate. */
export const ROOM_ID = /^[a-z0-9]{6,24}$/;
/** A room is a working session, not a broadcast. */
export const MAX_PEERS = 8;
/** A room is a sitting, not an account · it stops accepting people after
 *  this and disappears when the last one leaves. Nothing to clean up later,
 *  and a link that leaks is a link to nothing by tomorrow. */
export const ROOM_TTL_MS = 8 * 60 * 60 * 1000;
/** A whole drawing packs to about a kilobyte; this is room for twenty. */
export const MAX_MESSAGE = 64 * 1024;
export const MAX_NAME = 24;

export type ClientMessage =
  /** Everything I just changed. */
  | { t: "patch"; patch: StatePatch }
  /** I have just arrived and have nothing · somebody send me the drawing. */
  | { t: "need" }
  /** Here it is (an answer to `need`). */
  | { t: "state"; snapshot: StateSnapshot }
  /** Where I am working · a name and what I have selected. */
  | { t: "here"; name?: string; selected?: string | null }
  /** My pointer, in canvas coordinates · the cheapest thing that makes a
   *  room feel occupied, and the first thing missing when it does not. */
  | { t: "cursor"; x: number; y: number };

export type ServerMessage =
  | { t: "welcome"; me: string; peers: Peer[] }
  | { t: "joined"; peer: Peer }
  | { t: "left"; id: string }
  | { t: "full"; message: string }
  | { t: "expired"; message: string }
  /** The host left · the room is over for everyone in it. */
  | { t: "closed"; message: string }
  /** A client message, relayed, stamped with who sent it. */
  | (ClientMessage & { from: string });

export interface Peer {
  id: string;
  /** The one who opened the room · when they go, it goes. */
  host?: boolean;
  name?: string;
  selected?: string | null;
  /** Last known pointer, in canvas coordinates. */
  cursor?: { x: number; y: number };
}

/** One colour per person, from their id · stable for the session, and the
 *  same on everybody's screen because everybody derives it the same way. */
export const PEER_COLORS = ["#6FE3B0", "#F0B34E", "#E7157B", "#8C4FFF", "#3B82F6", "#F0796A", "#7AA116", "#00A4A6"];
export function peerColor(id: string): string {
  let n = 0;
  for (const c of id) n = (n * 31 + c.charCodeAt(0)) >>> 0;
  return PEER_COLORS[n % PEER_COLORS.length];
}

/** A room id anyone can make and nobody can guess. */
export function newRoomId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(36).padStart(2, "0")).join("").slice(0, 12);
}

/** Parse a message off the wire · null when it is not one of ours.
 *
 *  The relay runs this too. A room is public to whoever has the link, so
 *  everything arriving is a stranger's text until it has been through here. */
export function parseMessage(raw: unknown): ClientMessage | null {
  if (typeof raw !== "string" || raw.length > MAX_MESSAGE) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const m = value as Record<string, unknown>;
  switch (m.t) {
    case "patch":
      return m.patch && typeof m.patch === "object" && !Array.isArray(m.patch)
        ? { t: "patch", patch: m.patch as StatePatch }
        : null;
    case "need":
      return { t: "need" };
    case "state":
      return m.snapshot && typeof m.snapshot === "object" && Array.isArray((m.snapshot as StateSnapshot).nodes)
        ? { t: "state", snapshot: m.snapshot as StateSnapshot }
        : null;
    case "cursor":
      return typeof m.x === "number" && typeof m.y === "number" && Number.isFinite(m.x) && Number.isFinite(m.y)
        ? { t: "cursor", x: m.x, y: m.y }
        : null;
    case "here":
      return {
        t: "here",
        ...(typeof m.name === "string" ? { name: m.name.slice(0, MAX_NAME) } : {}),
        ...(typeof m.selected === "string" || m.selected === null ? { selected: m.selected as string | null } : {}),
      };
    default:
      return null;
  }
}
