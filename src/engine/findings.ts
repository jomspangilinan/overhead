// Findings are derived — recomputed on every mutation, never stored.
// Every rule cites an AWS doc; savings come from the same pricing table
// the costs do. No finding without a citation.

import type { Finding, StateSnapshot } from "./model";
import type { PricingTable } from "./pricing";
import { RULES } from "./rules";

export function allFindings(
  snapshot: StateSnapshot,
  pricing: PricingTable,
): Finding[] {
  const out: Finding[] = [];
  for (const rule of RULES) {
    try {
      out.push(...rule(snapshot, pricing));
    } catch {
      // a rule must never take the canvas down
    }
  }
  const order = { critical: 0, warn: 1, info: 2 } as const;
  return out.sort((a, b) => order[a.severity] - order[b.severity]);
}

export function findingsForNode(
  snapshot: StateSnapshot,
  pricing: PricingTable,
  nodeId: string,
): Finding[] {
  return allFindings(snapshot, pricing).filter((f) => f.nodeIds.includes(nodeId));
}
