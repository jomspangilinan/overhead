// The relay, locally.
//
// WebSocket upgrades are a platform feature: `next dev` cannot serve
// `app/api/room/route.ts`, so without this you could only test a room by
// deploying. This is the same `Relay` the function uses, wrapped in a plain
// `ws` server, so what you test locally is the code that runs in production ·
// only the socket around it differs.
//
//   npm run dev:room                       # this, on 3001
//   NEXT_PUBLIC_ROOM_WS=ws://localhost:3001 npm run dev
//
// In production the client talks to its own origin and none of this exists.

import { WebSocketServer } from "ws";
import { ROOM_ID } from "../src/net/protocol";
import { Relay } from "../src/net/relay";

const PORT = Number(process.env.ROOM_PORT ?? 3001);
const relay = new Relay();
const newId = () => Math.random().toString(36).slice(2, 10);

const wss = new WebSocketServer({ port: PORT });

wss.on("connection", (ws, request) => {
  const room = new URL(request.url ?? "/", "http://localhost").searchParams.get("room") ?? "";
  if (!ROOM_ID.test(room)) {
    ws.close(1008, "bad room id");
    return;
  }
  const member = relay.join(room, newId(), (message) => {
    try {
      ws.send(JSON.stringify(message));
    } catch {
      /* closed */
    }
  });
  if (!member) {
    ws.close();
    return;
  }
  console.log(`+ ${member.id} → ${room} (${relay.size(room)} here)`);
  ws.on("message", (data) => relay.message(room, member, data.toString()));
  ws.on("close", () => {
    relay.leave(room, member);
    console.log(`- ${member.id} ← ${room} (${relay.size(room)} here)`);
  });
});

console.log(`room relay on ws://localhost:${PORT}  ·  the same Relay the Vercel function uses`);
