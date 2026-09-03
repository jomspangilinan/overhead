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

const relay = new Relay();
const newId = () => Math.random().toString(36).slice(2, 10);

export async function GET(request: Request) {
  const room = new URL(request.url).searchParams.get("room") ?? "";
  if (!ROOM_ID.test(room)) {
    return new Response("A room id is 6 to 24 lowercase letters and digits.", { status: 400 });
  }

  return experimental_upgradeWebSocket((ws) => {
    const member = relay.join(room, newId(), (message) => {
      try {
        ws.send(JSON.stringify(message));
      } catch {
        // a socket that has gone away is cleaned up on close
      }
    });
    if (!member) {
      ws.close();
      return;
    }

    ws.on("message", (data: WebSocketData) => {
      relay.message(room, member, typeof data === "string" ? data : String(data));
    });
    ws.on("close", () => relay.leave(room, member));
  });
}
