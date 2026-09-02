import { defineService } from "../defineService";
import { price } from "../pricing";
import { defined, line, num, roleResource } from "./util";

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
  // stub definition · replace with your states
  definitionBody: sfn.DefinitionBody.fromChainable(new sfn.Pass(this, "${varName}Start")),
});`,
  cfnTypes: ["AWS::StepFunctions::StateMachine"],
  cfn: (s, { logicalId, resourceName }) => {
    const express = s.workflowType === "express";
    const role = roleResource(
      "Role",
      "states.amazonaws.com",
      s.iamRole === "broad" ? ["arn:aws:iam::aws:policy/PowerUserAccess"] : [],
    );
    role.Metadata = {
      Overhead:
        s.iamRole === "broad"
          ? "Execution role: a broad role was chosen on the canvas · scope it to the states you invoke."
          : "Execution role: least-privilege · grant only the actions your states call.",
    };
    return [
      role,
      {
        Type: "AWS::StepFunctions::StateMachine",
        Properties: {
          StateMachineName: resourceName,
          StateMachineType: express ? "EXPRESS" : "STANDARD",
          RoleArn: { "Fn::GetAtt": [`${logicalId}Role`, "Arn"] },
          DefinitionString: JSON.stringify({
            StartAt: "Start",
            States: { Start: { Type: "Pass", End: true } },
          }),
          ...(express
            ? {
                LoggingConfiguration: {
                  Level: "ERROR",
                  IncludeExecutionData: false,
                  Destinations: [],
                },
              }
            : {}),
        },
        DependsOn: [`${logicalId}Role`],
        Metadata: { Overhead: "Definition is a single Pass state · replace it with your states." },
      },
    ];
  },
  fromCfn: (p) =>
    defined({
      workflowType:
        p.StateMachineType === "EXPRESS" ? "express" : p.StateMachineType === "STANDARD" ? "standard" : undefined,
    }),
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
