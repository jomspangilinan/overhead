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

  const ids = new Set([...baseCosts.keys(), ...forkCosts.keys()]);
  const nodes: NodeDelta[] = [];
  for (const id of ids) {
    const b = baseCosts.has(id) ? toMoney(baseCosts.get(id)!) : null;
    const f = forkCosts.has(id) ? toMoney(forkCosts.get(id)!) : null;
    const d = toMoney((f ?? 0) - (b ?? 0));
    if (b !== null && f !== null && Math.abs(d) < 0.005) continue;
    nodes.push({ id, name: names.get(id) ?? id, base: b, fork: f, delta: d });
  }
  nodes.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  const baseTotal = toMoney(monthlyTotal(base, pricing));
  const forkTotal = toMoney(monthlyTotal(fork, pricing));
  return { baseTotal, forkTotal, delta: toMoney(forkTotal - baseTotal), nodes };
}
