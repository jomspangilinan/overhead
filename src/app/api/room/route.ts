// The relay, as a Vercel Function.
//
// One WebSocket endpoint and the least server that can exist: it forwards
// messages between the browsers in a room and forgets everything when the
// last one leaves. It never parses a drawing, never stores one, and never
// answers a question about one. The document still lives in the browsers ·
// this is a wire between them, and the bookkeeping is `net/relay.ts`, shared
// with the local dev server so what you test is what runs.
//
// Nothing here is contacted unless a URL carries a room id. Without one the
// app is the static page it has always been, and every tool still runs in
// the tab.
//
// Two honest limitations, both from the platform, both named rather than
// discovered later:
//
//   A connection is pinned to one function instance, and two people are not
//   guaranteed to land on the same one. Fluid compute keeps many connections
//   on a single instance, so a small room usually shares one · "usually" is
//   the truth. The fix is external pub/sub (Redis), which is a service and a
//   bill, and it is not worth either until somebody is actually using this.
//
//   A function has a maximum duration, so a long session is cut. The client
//   reconnects with backoff and asks for the drawing again · the same path a
//   newcomer takes, so it is exercised every time anyone joins.

import { experimental_upgradeWebSocket, type WebSocketData } from "@vercel/functions";
import { ROOM_ID } from "@/net/protocol";
import { Relay } from "@/net/relay";

export const dynamic = "force-dynamic";

/** A frame off the wire, as text.
 *
 *  Not `String(data)`: the platform hands binary frames over as a typed
 *  array, and `String(new Uint8Array(...))` is `"123,34,116…"` · the bytes,
 *  comma-separated. That parses as nothing, so every patch and every cursor
 *  was silently dropped in production while presence (which the server
 *  generates) kept working, and it looked like a room where nobody could
 *  draw. The local `ws` server hands over a Buffer, whose `String()` *is* the
 *  text, which is exactly why it never showed up in dev. */
function toText(data: WebSocketData): string {
  if (typeof data === "string") return data;
  if (data instanceof ArrayBuffer) return new TextDecoder().decode(data);
  if (ArrayBuffer.isView(data)) {
    return new TextDecoder().decode(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
  }
  return String(data);
}

const relay = new Relay();
const newId = () => Math.random().toString(36).slice(2, 10);

export async function GET(request: Request) {
  const room = new URL(request.url).searchParams.get("room") ?? "";
  if (!ROOM_ID.test(room)) {
    return new Response("A room id is 6 to 24 lowercase letters and digits.", { status: 400 });
  }
  // Opening this address in a browser is not an error worth a 500 · say what
  // it is for. Only an upgrade request goes any further.
  if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
    return new Response("This is a WebSocket relay for live rooms · connect with wss://, not GET.", {
      status: 426,
      headers: { Upgrade: "websocket" },
    });
  }

  return experimental_upgradeWebSocket((ws) => {
    const member = relay.join(room, newId(), (message) => {
      try {
        ws.send(JSON.stringify(message));
      } catch (err) {
        console.error("[room] send failed", message.t, String(err).slice(0, 200));
      }
    });
    if (!member) {
      ws.close();
      return;
    }

    ws.on("message", (data: WebSocketData) => relay.message(room, member, toText(data)));
    ws.on("close", () => relay.leave(room, member));
  });
}
