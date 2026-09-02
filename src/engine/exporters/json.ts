// JSON state export: the whole model plus the pricing snapshot identity.
// Reloads exactly via import_state.

import type { StateSnapshot } from "../model";
import type { PricingTable } from "../pricing";

export interface JsonExport extends StateSnapshot {
  overhead: {
    version: 1;
    region: string;
    pricingGeneratedAt: string;
    exportedAt: string;
  };
}

export function exportJson(
  snapshot: StateSnapshot,
  pricing: PricingTable,
  now: Date = new Date(),
): string {
  const payload: JsonExport = {
    nodes: snapshot.nodes,
    edges: snapshot.edges,
    containers: snapshot.containers,
    sections: snapshot.sections,
    traffic: snapshot.traffic,
    overhead: {
      version: 1,
      region: pricing.region,
      pricingGeneratedAt: pricing.generatedAt,
      exportedAt: now.toISOString(),
    },
  };
  return JSON.stringify(payload, null, 2);
}
