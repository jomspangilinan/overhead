// Mermaid export: flowchart LR, node labels carry the monthly figure,
// the three edge kinds keep their encodings (sync solid arrow, async
// dotted arrow, data open link).

import type { StateSnapshot } from "../model";
import type { PricingTable } from "../pricing";
import { allCosts } from "../cost";
import { toMoney } from "../model";

function mmId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, "_");
}

function esc(text: string): string {
  return text.replace(/"/g, "#quot;");
}

export function exportMermaid(
  snapshot: StateSnapshot,
  pricing: PricingTable,
): string {
  const costs = new Map(
    allCosts(snapshot, pricing).map((c) => [c.nodeId, c.monthly]),
  );
  const lines: string[] = ["flowchart LR"];
  for (const n of snapshot.nodes) {
    const monthly = toMoney(costs.get(n.id) ?? 0).toFixed(2);
    lines.push(`  ${mmId(n.id)}["${esc(n.name)}<br/>$${monthly}/mo"]`);
  }
  for (const e of snapshot.edges) {
    const label = e.label ?? (e.volumePerMonth ? `${e.volumePerMonth}` : "");
    const from = mmId(e.from);
    const to = mmId(e.to);
    const l = label ? `|${esc(label)}|` : "";
    if (e.kind === "async") lines.push(`  ${from} -.->${l} ${to}`);
    else if (e.kind === "data") lines.push(`  ${from} ---${l} ${to}`);
    else lines.push(`  ${from} -->${l} ${to}`);
  }
  return lines.join("\n") + "\n";
}
