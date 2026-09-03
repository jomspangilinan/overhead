// The room, without a socket.
//
// The bookkeeping a relay does · who is in which room, who gets told what,
// what is refused · is the part worth testing, and it has nothing to do with
// WebSockets. So it lives here as a plain object with callbacks, and both
// transports use it: the Vercel function in `app/api/room/route.ts`, and the
// local `ws` server in `scripts/dev-room.ts` (WebSocket upgrades are a
// platform feature, so `next dev` cannot serve the real route).
//
// One implementation, so the thing you test locally is the thing that runs.

import { MAX_MESSAGE, MAX_PEERS, ROOM_TTL_MS, parseMessage, type Peer, type ServerMessage } from "./protocol";

export interface Member {
  id: string;
  peer: Peer;
  send: (message: ServerMessage) => void;
}

export class Relay {
  private rooms = new Map<string, Set<Member>>();
  /** When each room first opened · a room stops taking people after
   *  `ROOM_TTL_MS` and vanishes when the last one leaves, so a link that
   *  gets forwarded around is a link to nothing by tomorrow. There is
   *  nothing to expire in storage because nothing was ever stored. */
  private opened = new Map<string, number>();
  /** Who opened each room · the first one in. A room is that person's
   *  sitting, so when they leave it ends for everybody rather than lingering
   *  with whoever happened to still have the tab open. */
  private host = new Map<string, string>();
  /** Ids that are over, and when · so a straggler reconnecting into a closed
   *  room is told it is closed instead of silently becoming the new host of
   *  an empty one. Pruned on the next join, so this cannot grow forever. */
  private closed = new Map<string, number>();

  /** Injectable so the expiry is testable without waiting eight hours. */
  constructor(private now: () => number = Date.now) {}

  /** For the dev server's log line, and nothing else. */
  size(room: string): number {
    return this.rooms.get(room)?.size ?? 0;
  }

  /** Returns the member, or null when the room is full (already told why). */
  join(room: string, id: string, send: Member["send"]): Member | null {
    for (const [key, at] of this.closed) if (this.now() - at > ROOM_TTL_MS) this.closed.delete(key);
    if (this.closed.has(room)) {
      send({ t: "expired", message: "That room is closed · the person who started it has left." });
      return null;
    }
    const opened = this.opened.get(room);
    if (opened !== undefined && this.now() - opened > ROOM_TTL_MS) {
      send({ t: "expired", message: "This room has expired · start a new one and share that link." });
      return null;
    }
    const members = this.rooms.get(room) ?? new Set<Member>();
    this.rooms.set(room, members);
    if (opened === undefined) this.opened.set(room, this.now());
    if (!this.host.has(room)) this.host.set(room, id);
    const member: Member = { id, peer: { id, ...(this.host.get(room) === id ? { host: true } : {}) }, send };

    if (members.size >= MAX_PEERS) {
      send({ t: "full", message: `This room already has ${MAX_PEERS} people in it.` });
      return null;
    }

    const others = [...members];
    members.add(member);
    send({ t: "welcome", me: id, peers: others.map((m) => m.peer) });
    for (const other of others) other.send({ t: "joined", peer: member.peer });
    return member;
  }

  /** Relay one raw message to everyone else in the room. */
  message(room: string, from: Member, raw: unknown): void {
    if (typeof raw === "string" && raw.length > MAX_MESSAGE) return;
    const message = parseMessage(raw);
    if (!message) return;
    // Presence is the only thing the relay remembers, so somebody arriving
    // late is told who is here instead of waiting for them to move.
    if (message.t === "cursor") {
      from.peer = { ...from.peer, cursor: { x: message.x, y: message.y } };
    }
    if (message.t === "here") {
      from.peer = {
        ...from.peer,
        ...(message.name ? { name: message.name } : {}),
        selected: message.selected ?? null,
      };
    }
    for (const other of this.rooms.get(room) ?? []) {
      if (other !== from) other.send({ ...message, from: from.id });
    }
  }

  leave(room: string, member: Member): void {
    const members = this.rooms.get(room);
    if (!members) return;
    members.delete(member);

    // The host leaving ends the sitting · everyone is told why, and the id
    // is spent so a reconnect does not quietly reopen it.
    if (this.host.get(room) === member.id) {
      for (const other of members) {
        other.send({ t: "closed", message: "The person who started this room has left · the room is closed." });
      }
      this.forget(room);
      return;
    }

    if (!members.size) {
      // The room's age goes with it · the id means nothing once it is empty.
      this.forget(room);
      return;
    }
    for (const other of members) other.send({ t: "left", id: member.id });
  }

  private forget(room: string): void {
    this.rooms.delete(room);
    this.opened.delete(room);
    this.host.delete(room);
    this.closed.set(room, this.now());
  }
}
