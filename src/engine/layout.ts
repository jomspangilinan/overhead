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

export interface AutoLayoutResult {
  positions: Record<string, { x: number; y: number }>;
  /** One per non-empty role — ordinary sections the user may rename or delete. */
  sections: { name: string; color: string; nodeIds: string[] }[];
}

const SECTION_COLORS = ["#3B82F6", "#E7157B", "#F0B34E", "#7AA116", "#8C4FFF"];

/**
 * Arrange left to right by role and describe the arrangement as sections.
 * The roles are a suggestion the user can throw away — never structure.
 */
export function autoLayoutWithSections(nodes: ArchNode[]): AutoLayoutResult {
  const positions = autoLayout(nodes);
  const byRole = new Map<Role, string[]>();
  for (const n of nodes) {
    const role = roleOf(n);
    byRole.set(role, [...(byRole.get(role) ?? []), n.id]);
  }
  const sections = ROLE_ORDER.filter((r) => byRole.get(r)?.length).map((r, i) => ({
    name: ROLE_LABELS[r][0] + ROLE_LABELS[r].slice(1).toLowerCase(),
    color: SECTION_COLORS[i % SECTION_COLORS.length],
    nodeIds: byRole.get(r)!,
  }));
  return { positions, sections };
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
