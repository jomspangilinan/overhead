import { defineService } from "../defineService";
import { price } from "../pricing";
import { line, num } from "./util";

export const stepfunctions = defineService({
  id: "stepfunctions",
  term: "AWS Step Functions",
  icon: "aws-stepfunctions",
  role: "workers",
  settings: {
    workflowType: {
      type: "enum",
      values: ["standard", "express"],
      default: "standard",
      label: "Workflow type",
      driver: true,
    },
    executionsPerMonth: {
      type: "number",
      min: 0,
      optional: true,
      label: "Executions / month",
      driver: true,
      description: "Defaults to the canvas traffic figure",
    },
    avgTransitionsPerExecution: {
      type: "number",
      min: 1,
      default: 5,
      label: "Avg state transitions",
      driver: true,
    },
    hasHumanWaitStep: {
      type: "boolean",
      default: false,
      label: "Human-wait step",
      description: "Waits > 5 min require Standard workflows",
    },
    expressAvgDurationMs: {
      type: "number",
      min: 1,
      default: 100,
      label: "Express avg duration (ms)",
      driver: true,
    },
    expressMemoryMb: {
      type: "number",
      min: 64,
      default: 64,
      label: "Express memory (MB)",
      driver: true,
    },
    iamRole: {
      type: "enum",
      values: ["least-privilege", "broad"],
      default: "least-privilege",
      label: "Execution role",
      group: "security",
    },
  },
  badge: (s) => (s.iamRole === "broad" ? "broad IAM" : "IAM role"),
  cardLines: ["workflowType", "executionsPerMonth", "avgTransitionsPerExecution"],
  cdk: (s, { varName, resourceName }) =>
    `new sfn.StateMachine(this, "${varName}", {
  stateMachineName: "${resourceName}",
  stateMachineType: sfn.StateMachineType.${s.workflowType === "express" ? "EXPRESS" : "STANDARD"},
  // stub definition — replace with your states
  definitionBody: sfn.DefinitionBody.fromChainable(new sfn.Pass(this, "${varName}Start")),
});`,
  price: (s, traffic, pricing) => {
    const executions = num(s.executionsPerMonth, traffic.requestsPerMonth);
    if (s.workflowType === "express") {
      const durationSec = num(s.expressAvgDurationMs, 100) / 1000;
      const memoryGb = num(s.expressMemoryMb, 64) / 1024;
      const gbSeconds = executions * durationSec * memoryGb;
      return [
        line(price(pricing, "stepfunctions.expressRequests"), executions),
        line(price(pricing, "stepfunctions.expressGbSecond"), gbSeconds),
      ];
    }
    const transitions = executions * num(s.avgTransitionsPerExecution, 5);
    return [line(price(pricing, "stepfunctions.stateTransitions"), transitions)];
  },
});
