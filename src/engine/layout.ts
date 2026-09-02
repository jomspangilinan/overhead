// Lane auto-layout: Ingress → Handlers → Messaging → Workers → Data,
// left to right; rows assigned per lane in node order. Pure function —
// returns new positions, mutates nothing.

import type { ArchNode, Lane } from "./model";
import { getService } from "./services";

export const LANE_ORDER: Lane[] = [
  "ingress",
  "handlers",
  "messaging",
  "workers",
  "data",
];

export const LANE_LABELS: Record<Lane, string> = {
  ingress: "INGRESS",
  handlers: "HANDLERS",
  messaging: "MESSAGING",
  workers: "WORKERS",
  data: "DATA",
};

const LANE_GAP = 260;
const ROW_GAP = 150;
const X0 = 80;
const Y0 = 80;

export function laneOf(node: ArchNode): Lane {
  return node.lane ?? getService(node.service)?.lane ?? "handlers";
}

export function autoLayout(
  nodes: ArchNode[],
): Record<string, { x: number; y: number }> {
  const rows = new Map<Lane, number>();
  const out: Record<string, { x: number; y: number }> = {};
  for (const node of nodes) {
    const lane = laneOf(node);
    const row = rows.get(lane) ?? 0;
    rows.set(lane, row + 1);
    out[node.id] = {
      x: X0 + LANE_ORDER.indexOf(lane) * LANE_GAP,
      y: Y0 + row * ROW_GAP,
    };
  }
  return out;
}
