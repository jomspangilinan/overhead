import type { Rule } from "./index";
import { effective } from "./util";

export const unboundedFanout: Rule = (snapshot) =>
  snapshot.nodes
    .filter((n) => n.service === "sns")
    .flatMap((sns) => {
      const consumers = snapshot.edges
        .filter((e) => e.from === sns.id)
        .map((e) => snapshot.nodes.find((n) => n.id === e.to))
        .filter((n) => n?.service === "lambda");
      const unbounded = consumers.filter(
        (n) => n && effective(n).reservedConcurrency === undefined,
      );
      if (consumers.length < 2 || unbounded.length === 0) return [];
      return [
        {
          rule: "unbounded_fanout",
          severity: "warn" as const,
          message: `${sns.name} fans out to ${consumers.length} Lambdas with no concurrency limit. A burst multiplies through the topic and can exhaust account concurrency — reserve capacity per consumer.`,
          docUrl:
            "https://docs.aws.amazon.com/wellarchitected/latest/serverless-applications-lens/welcome.html",
          nodeIds: [sns.id, ...unbounded.map((n) => n!.id)],
        },
      ];
    });
