// Cost is a derived selector — recomputed on every mutation, never stored.

import type { NodeCost, StateSnapshot } from "./model";
import type { PricingTable } from "./pricing";
import { defaultSettings } from "./defineService";
import { getService } from "./services";

export function nodeCost(
  snapshot: StateSnapshot,
  nodeId: string,
  pricing: PricingTable,
): NodeCost {
  const node = snapshot.nodes.find((n) => n.id === nodeId);
  if (!node) throw new Error(`No node "${nodeId}"`);
  const def = getService(node.service);
  if (!def) throw new Error(`Unknown service "${node.service}"`);
  const settings = { ...defaultSettings(def), ...node.settings };
  const lines = def.price(settings, snapshot.traffic, pricing);
  return {
    nodeId,
    lines,
    monthly: lines.reduce((sum, l) => sum + l.monthly, 0),
  };
}

export function allCosts(
  snapshot: StateSnapshot,
  pricing: PricingTable,
): NodeCost[] {
  return snapshot.nodes.map((n) => nodeCost(snapshot, n.id, pricing));
}

export function monthlyTotal(
  snapshot: StateSnapshot,
  pricing: PricingTable,
): number {
  return allCosts(snapshot, pricing).reduce((sum, c) => sum + c.monthly, 0);
}
