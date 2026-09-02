// Markdown export: title, assumptions, cost table by node, findings with
// their doc links, and the Mermaid diagram inline. Client-readable.

import type { StateSnapshot } from "../model";
import type { PricingTable } from "../pricing";
import { allCosts, monthlyTotal } from "../cost";
import { allFindings } from "../findings";
import { toMoney } from "../model";
import { getService } from "../services";
import { exportMermaid } from "./mermaid";

export function exportMarkdown(
  snapshot: StateSnapshot,
  pricing: PricingTable,
  title = "Architecture estimate",
): string {
  const costs = allCosts(snapshot, pricing).sort((a, b) => b.monthly - a.monthly);
  const findings = allFindings(snapshot, pricing);
  const total = toMoney(monthlyTotal(snapshot, pricing));

  const out: string[] = [
    `# ${title}`,
    "",
    `**Monthly estimate: $${total.toFixed(2)}** · ${snapshot.nodes.length} resources`,
    "",
    "## Assumptions",
    "",
    `- Traffic: ${snapshot.traffic.requestsPerMonth.toLocaleString("en-US")} requests/month, ${snapshot.traffic.avgPayloadKb} KB average payload`,
    `- Pricing: AWS Price List, region \`${pricing.region}\`, fetched ${pricing.generatedAt.slice(0, 10)}`,
    "- Free tiers not applied; rates are first-tier public on-demand",
    "",
    "## Cost by resource",
    "",
    "| Resource | Service | Monthly |",
    "|---|---|---:|",
  ];
  for (const c of costs) {
    const node = snapshot.nodes.find((n) => n.id === c.nodeId);
    if (!node) continue;
    const term = getService(node.service)?.term ?? node.service;
    out.push(`| ${node.name} | ${term} | $${toMoney(c.monthly).toFixed(2)} |`);
  }
  out.push(`| **Total** | | **$${total.toFixed(2)}** |`, "");

  if (findings.length) {
    out.push("## Findings", "");
    for (const f of findings) {
      const saving = f.estimatedSaving
        ? ` *(≈ $${f.estimatedSaving.toFixed(2)}/mo)*`
        : "";
      out.push(`- **${f.severity}** — ${f.message}${saving} · [AWS docs](${f.docUrl})`);
    }
    out.push("");
  }

  out.push("## Diagram", "", "```mermaid", exportMermaid(snapshot, pricing).trimEnd(), "```", "");
  return out.join("\n");
}
