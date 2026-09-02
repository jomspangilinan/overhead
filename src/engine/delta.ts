// Base vs fork comparison — pure, derived, never stored.

import type { StateSnapshot } from "./model";
import { toMoney } from "./model";
import type { PricingTable } from "./pricing";
import { allCosts, monthlyTotal } from "./cost";

export interface NodeDelta {
  id: string;
  name: string;
  base: number | null;
  fork: number | null;
  delta: number;
  /** What happened to this resource in the fork. */
  kind: "added" | "removed" | "changed";
  /** The settings that differ, so the fork can say what it did and not
   *  only what it cost · a change that leaves the bill alone is still a
   *  change worth showing. */
  changes: { key: string; from: unknown; to: unknown }[];
}

export interface Delta {
  baseTotal: number;
  forkTotal: number;
  delta: number;
  nodes: NodeDelta[];
}

export function computeDelta(
  base: StateSnapshot,
  fork: StateSnapshot,
  pricing: PricingTable,
): Delta {
  const baseCosts = new Map(allCosts(base, pricing).map((c) => [c.nodeId, c.monthly]));
  const forkCosts = new Map(allCosts(fork, pricing).map((c) => [c.nodeId, c.monthly]));
  const names = new Map<string, string>();
  for (const n of base.nodes) names.set(n.id, n.name);
  for (const n of fork.nodes) names.set(n.id, n.name);

  const baseNodes = new Map(base.nodes.map((n) => [n.id, n]));
  const forkNodes = new Map(fork.nodes.map((n) => [n.id, n]));

  const ids = new Set([...baseCosts.keys(), ...forkCosts.keys()]);
  const nodes: NodeDelta[] = [];
  for (const id of ids) {
    const b = baseCosts.has(id) ? toMoney(baseCosts.get(id)!) : null;
    const f = forkCosts.has(id) ? toMoney(forkCosts.get(id)!) : null;
    const d = toMoney((f ?? 0) - (b ?? 0));
    const before = baseNodes.get(id);
    const after = forkNodes.get(id);
    const changes: NodeDelta["changes"] = [];
    if (before && after) {
      for (const key of new Set([...Object.keys(before.settings), ...Object.keys(after.settings)])) {
        const from = before.settings[key];
        const to = after.settings[key];
        if (JSON.stringify(from) !== JSON.stringify(to)) changes.push({ key, from, to });
      }
      if (before.name !== after.name) changes.push({ key: "name", from: before.name, to: after.name });
    }
    if (b !== null && f !== null && Math.abs(d) < 0.005 && !changes.length) continue;
    nodes.push({
      id,
      name: names.get(id) ?? id,
      base: b,
      fork: f,
      delta: d,
      kind: b === null ? "added" : f === null ? "removed" : "changed",
      changes,
    });
  }
  nodes.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.name.localeCompare(b.name));

  const baseTotal = toMoney(monthlyTotal(base, pricing));
  const forkTotal = toMoney(monthlyTotal(fork, pricing));
  return { baseTotal, forkTotal, delta: toMoney(forkTotal - baseTotal), nodes };
}
