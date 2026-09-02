import type { Rule } from "./index";
import { price } from "../pricing";
import { byService, effective, num, requestsOf, saving } from "./util";

export const standardWorkflowHighVolume: Rule = (snapshot, pricing) =>
  byService(snapshot, "stepfunctions").flatMap((node) => {
    const s = effective(node);
    if (s.workflowType !== "standard" || s.hasHumanWaitStep === true) return [];
    const executions = requestsOf(s, "executionsPerMonth", snapshot.traffic);
    if (executions <= 100_000) return [];
    const transitions = executions * num(s.avgTransitionsPerExecution, 5);
    const standardCost =
      transitions * price(pricing, "stepfunctions.stateTransitions").rate;
    const gbSeconds =
      executions *
      (num(s.expressAvgDurationMs, 100) / 1000) *
      (num(s.expressMemoryMb, 64) / 1024);
    const expressCost =
      executions * price(pricing, "stepfunctions.expressRequests").rate +
      gbSeconds * price(pricing, "stepfunctions.expressGbSecond").rate;
    if (expressCost >= standardCost) return [];
    return [
      {
        rule: "standard_workflow_high_volume",
        severity: "warn" as const,
        message: `${node.name} runs ${(executions / 1000).toFixed(0)}k Standard executions/month with no human-wait step. Express workflows price by duration, not transitions, and are cheaper at this volume.`,
        docUrl: "https://aws.amazon.com/step-functions/pricing/",
        nodeIds: [node.id],
        estimatedSaving: saving(standardCost - expressCost),
      },
    ];
  });
