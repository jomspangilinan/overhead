import type { Rule } from "./index";
import { effective } from "./util";

export const asyncNoDlq: Rule = (snapshot) => {
  const findings = [];
  for (const node of snapshot.nodes) {
    if (node.service !== "lambda" && node.service !== "sqs") continue;
    const consumesAsync = snapshot.edges.some(
      (e) => e.to === node.id && e.kind === "async",
    );
    if (!consumesAsync) continue;
    if (effective(node).dlqConfigured === true) continue;
    findings.push({
      rule: "async_no_dlq",
      severity: "critical" as const,
      message: `${node.name} consumes async events with no DLQ or on-failure destination. A poison message retries until it expires, then disappears — set a dead-letter target.`,
      docUrl: "https://docs.aws.amazon.com/lambda/latest/dg/invocation-async.html",
      nodeIds: [node.id],
    });
  }
  return findings;
};
