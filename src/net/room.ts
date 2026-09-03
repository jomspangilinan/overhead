"use client";

// Being in a room.
//
// Opt-in and invisible until asked for: no room id in the URL, no socket, no
// network, nothing different about the app. With one, this module is the only
// thing that talks to a server, and all it moves are patches.
//
// The loop, and the two rules that keep it from feeding itself:
//
//   Local → wire. The store is watched; when the drawing changes, the change
//   is worked out as a patch against what we last saw (`diffSnapshots`) and
//   sent. Debounced, because a drag is a hundred store writes and one edit.
//
//   Wire → local. A patch from somebody else goes through `applyPatch`, the
//   same door the agent's `patch_state` uses · so a remote edit is validated
//   exactly like a local one, and a peer running an old build cannot put a
//   setting on my canvas that my build would refuse.
//
//   `applying` guards the echo: while a remote patch is being written into
//   the store, the watcher must not read that write back out and broadcast
//   it. Without it two browsers ping-pong the same patch forever.
//
//   `mirror` is what the other side is believed to have. It advances on both
//   send and receive, so the next diff is against the shared truth rather
//   than against my own last frame.

import { useStore, snapshotOf } from "@/store/useStore";
import { applyPatch, diffSnapshots } from "@/engine/patch";
import type { StateSnapshot } from "@/engine/model";
import {
  MAX_PEERS,
  newRoomId,
  parseMessage,
  type ClientMessage,
  type Peer,
  type ServerMessage,
} from "./protocol";

const SEND_EVERY = 120;
const RETRY_MIN = 800;
const RETRY_MAX = 15000;

let socket: WebSocket | null = null;
let unwatch: (() => void) | null = null;
let mirror: StateSnapshot | null = null;
let applying = false;
let pending: ReturnType<typeof setTimeout> | null = null;
let retry = RETRY_MIN;
let closing = false;
let roomId: string | null = null;
/** Waiting for the room's drawing · until it lands, mine is not the room's
 *  and must not be sent to anybody. */
let awaiting = false;

const store = () => useStore.getState();

function send(message: ClientMessage) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

/** The drawing changed here · tell the room what changed, not everything. */
function broadcast() {
  pending = null;
  if (applying || !mirror) return;
  const now = snapshotOf(store());
  const patch = diffSnapshots(mirror, now);
  if (!patch) return;
  mirror = structuredClone(now);
  send({ t: "patch", patch });
}

function watch() {
  unwatch?.();
  unwatch = useStore.subscribe((s, prev) => {
    if (applying) return;
    if (
      s.nodes === prev.nodes &&
      s.edges === prev.edges &&
      s.containers === prev.containers &&
      s.sections === prev.sections &&
      s.traffic === prev.traffic
    ) {
      // Selection moved, not the drawing · presence is cheap, send that.
      if (s.selectedId !== prev.selectedId) send({ t: "here", selected: s.selectedId });
      return;
    }
    if (pending) clearTimeout(pending);
    pending = setTimeout(broadcast, SEND_EVERY);
  });
}

/** Write somebody else's change in, without sending it back out. */
function receive(message: ServerMessage) {
  const s = store();
  switch (message.t) {
    case "welcome": {
      // Nobody here yet = I opened it. The relay agrees: it makes the first
      // one in the host, and ends the room when they leave.
      s.setRoom({ id: roomId!, me: message.me, peers: message.peers, status: "live", host: !message.peers.length });
      // **A room has one drawing.** If anybody is already here, theirs is it,
      // and mine is set aside · joining does not merge two drawings together.
      //
      // Merging is what the first version did, by leaving `mirror` pointing
      // at my own canvas: my next edit then diffed against my drawing and was
      // applied to theirs, so event-driven and media-pipeline fused into one
      // nine-resource chimera on both screens. There is no sensible union of
      // two architectures · one of them has to win, and the room was here
      // first.
      if (message.peers.length) {
        awaiting = true;
        // `mirror` stays null until the drawing arrives, which is also what
        // stops me broadcasting my old one in the meantime (`broadcast`
        // returns early without a mirror).
        mirror = null;
        send({ t: "need" });
      } else {
        // Nobody here · this is my room and my drawing is the room's.
        awaiting = false;
        mirror = structuredClone(snapshotOf(s));
      }
      send({ t: "here", selected: s.selectedId });
      return;
    }
    case "joined":
      s.setRoom({ peers: [...(s.room?.peers ?? []), message.peer] });
      s.notify(`Somebody joined this room · ${(s.room?.peers.length ?? 0) + 1} here`);
      return;
    case "left":
      s.setRoom({ peers: (s.room?.peers ?? []).filter((p) => p.id !== message.id) });
      return;
    case "full":
    case "expired":
    case "closed":
      s.notify(message.message, "bad");
      leaveRoom();
      return;
    case "need":
      // Anyone already settled in the room answers · two answers are the
      // same answer, and the asker takes the first. Somebody still waiting
      // for the drawing themselves has nothing to send.
      if (!awaiting) send({ t: "state", snapshot: snapshotOf(store()) });
      return;
    case "state": {
      if (!awaiting) return; // not waiting for one · mine is the room's
      awaiting = false;
      const had = store().nodes.length;
      applying = true;
      try {
        store().loadSnapshot(message.snapshot);
        mirror = structuredClone(message.snapshot);
      } finally {
        applying = false;
      }
      // Losing what you were looking at without being told is the thing
      // that makes a shared canvas feel unsafe.
      store().notify(
        had
          ? `Joined the room · showing the room's drawing. Yours is not lost: leave the room to get it back.`
          : "Joined the room",
      );
      return;
    }
    case "cursor": {
      // Cursors move constantly and mean nothing after the next one · they
      // are kept on the peer and never touch the drawing or the undo stack.
      s.setRoom({
        peers: (s.room?.peers ?? []).map((p) =>
          p.id === message.from ? { ...p, cursor: { x: message.x, y: message.y } } : p,
        ),
      });
      return;
    }
    case "here": {
      const peers = (s.room?.peers ?? []).map((p) =>
        p.id === message.from ? { ...p, ...(message.name ? { name: message.name } : {}), selected: message.selected ?? null } : p,
      );
      s.setRoom({ peers });
      return;
    }
    case "patch": {
      applying = true;
      try {
        const result = applyPatch(snapshotOf(store()), message.patch);
        if (result.ok) {
          store().loadSnapshot(result.snapshot);
          mirror = structuredClone(result.snapshot);
        } else {
          // A refusal is worth seeing · it means the two builds disagree.
          store().notify(`A change from the room was refused: ${result.message}`, "warn");
        }
      } finally {
        applying = false;
      }
      return;
    }
  }
}

function connect(id: string) {
  const scheme = location.protocol === "https:" ? "wss" : "ws";
  const base = process.env.NEXT_PUBLIC_ROOM_WS || `${scheme}://${location.host}`;
  socket = new WebSocket(`${base}/api/room?room=${encodeURIComponent(id)}`);

  socket.addEventListener("open", () => {
    retry = RETRY_MIN;
    store().setRoom({ id, status: "live", peers: [] });
  });

  socket.addEventListener("message", (e) => {
    const raw = typeof e.data === "string" ? e.data : "";
    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      return;
    }
    const m = value as ServerMessage;
    // Server-sent notices have their own shapes; relayed client messages are
    // validated with the same parser the relay used.
    if (m?.t === "welcome" || m?.t === "joined" || m?.t === "left" || m?.t === "full" || m?.t === "expired" || m?.t === "closed") {
      receive(m);
      return;
    }
    const checked = parseMessage(raw);
    if (checked && typeof (m as { from?: string }).from === "string") {
      receive({ ...checked, from: (m as { from: string }).from });
    }
  });

  socket.addEventListener("close", () => {
    socket = null;
    if (closing) return;
    // A function has a maximum duration, so this is expected, not a failure.
    store().setRoom({ status: "reconnecting" });
    setTimeout(() => {
      if (roomId) connect(roomId);
    }, retry);
    retry = Math.min(retry * 2, RETRY_MAX);
  });
}

/** Join (or make) a room · the URL carries the id so a link is the invite. */
export function joinRoom(id = newRoomId()): string {
  leaveRoom();
  closing = false;
  roomId = id;
  mirror = structuredClone(snapshotOf(store()));
  store().setRoom({ id, status: "connecting", peers: [], me: "" });
  const url = new URL(location.href);
  url.searchParams.set("room", id);
  history.replaceState(null, "", url.toString());
  watch();
  connect(id);
  return id;
}

export function leaveRoom() {
  closing = true;
  if (pending) clearTimeout(pending);
  pending = null;
  unwatch?.();
  unwatch = null;
  socket?.close();
  socket = null;
  roomId = null;
  mirror = null;
  const url = new URL(location.href);
  if (url.searchParams.has("room")) {
    url.searchParams.delete("room");
    history.replaceState(null, "", url.toString());
  }
  store().setRoom(null);
}

/** Where my pointer is, throttled · canvas coordinates, so it lands in the
 *  same place on a screen at a different zoom. */
let lastCursor = 0;
export function sendCursor(x: number, y: number) {
  const now = Date.now();
  if (now - lastCursor < 55) return;
  lastCursor = now;
  send({ t: "cursor", x: Math.round(x), y: Math.round(y) });
}

/** The invite · the room id in the URL, nothing else. */
export function roomLink(): string | null {
  const room = store().room;
  if (!room) return null;
  const url = new URL(location.href);
  url.hash = "";
  url.searchParams.set("room", room.id);
  return url.toString();
}

export { MAX_PEERS, type Peer };
