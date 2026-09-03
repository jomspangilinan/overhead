import type { NextConfig } from "next";

// `output: "export"` on `main` · the app is a static page and the pitch says
// so. This branch adds one WebSocket function (`app/api/room/route.ts`), and
// a function cannot be part of a static export, so the export is off here.
// Everything else is unchanged: without a room id in the URL nothing ever
// contacts the server, and every tool still runs in the tab.
const nextConfig: NextConfig = {
  // `@vercel/functions/websocket` requires `ws` at runtime. Bundled into the
  // server chunk it loses its unmasking path (`b.unmask is not a function`),
  // and **every browser frame is masked**, so every patch and every cursor
  // died on arrival while server-generated presence kept working · a room
  // where two people could see each other and neither could draw. Node
  // clients happened to survive it, which is why the first production test
  // looked fine. Kept external, `ws` is required from node_modules intact,
  // and `bufferutil` gives it the native unmask.
  serverExternalPackages: ["ws"],
};

export default nextConfig;
