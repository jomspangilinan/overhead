// Role auto-layout: Ingress → Handlers → Messaging → Workers → Data,
// left to right; rows assigned per lane in node order. Pure function —
// returns new positions, mutates nothing.

import type { ArchNode, Role } from "./model";
import { getService } from "./services";

export const ROLE_ORDER: Role[] = [
  "ingress",
  "handlers",
  "messaging",
  "workers",
  "data",
];

export const ROLE_LABELS: Record<Role, string> = {
  ingress: "INGRESS",
  handlers: "HANDLERS",
  messaging: "MESSAGING",
  workers: "WORKERS",
  data: "DATA",
};

const ROLE_GAP = 260;
const ROW_GAP = 150;
const X0 = 80;
const Y0 = 80;

export function roleOf(node: ArchNode): Role {
  return getService(node.service)?.role ?? "handlers";
}

/** Position for one new node: its lane column, first free row — nothing else moves. */
export function placeInRole(nodes: ArchNode[], lane: Role): { x: number; y: number } {
  const inRole = nodes.filter((n) => roleOf(n) === lane);
  return {
    x: X0 + ROLE_ORDER.indexOf(lane) * ROLE_GAP,
    y: inRole.length
      ? Math.max(...inRole.map((n) => n.position.y)) + ROW_GAP
      : Y0,
  };
}

export function autoLayout(
  nodes: ArchNode[],
): Record<string, { x: number; y: number }> {
  const rows = new Map<Role, number>();
  const out: Record<string, { x: number; y: number }> = {};
  for (const node of nodes) {
    const lane = roleOf(node);
    const row = rows.get(lane) ?? 0;
    rows.set(lane, row + 1);
    out[node.id] = {
      x: X0 + ROLE_ORDER.indexOf(lane) * ROLE_GAP,
      y: Y0 + row * ROW_GAP,
    };
  }
  return out;
}
