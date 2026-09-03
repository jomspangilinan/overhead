import type { NextConfig } from "next";

// `output: "export"` on `main` · the app is a static page and the pitch says
// so. This branch adds one WebSocket function (`app/api/room/route.ts`), and
// a function cannot be part of a static export, so the export is off here.
// Everything else is unchanged: without a room id in the URL nothing ever
// contacts the server, and every tool still runs in the tab.
const nextConfig: NextConfig = {};

export default nextConfig;
