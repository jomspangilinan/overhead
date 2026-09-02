import { defineService } from "../defineService";
import { price } from "../pricing";
import { line, num } from "./util";
import type { CfnResource } from "../defineService";

export const eventbridge = defineService({
  id: "eventbridge",
  term: "Amazon EventBridge",
  icon: "aws-eventbridge",
  role: "messaging",
  settings: {
    eventsPerMonth: {
      type: "number",
      min: 0,
      optional: true,
      label: "Custom events / month",
      driver: true,
      description: "Defaults to the canvas traffic figure",
    },
    rules: {
      type: "number",
      min: 0,
      default: 1,
      label: "Rules",
      description: "Rules and their targets cost nothing · you pay per event published, and on the target",
    },
    resourcePolicy: {
      type: "boolean",
      default: false,
      label: "Resource policy",
      description: "Cross-account or scoped PutEvents policy on the bus",
      group: "security",
    },
  },
  badge: (s) => (s.resourcePolicy === true ? "resource policy" : "default policy"),
  cardLines: ["eventsPerMonth"],
  cdk: (_s, { varName, resourceName }) =>
    `new events.EventBus(this, "${varName}", { eventBusName: "${resourceName}" });`,
  cfnTypes: ["AWS::Events::EventBus"],
  cfn: (s, { logicalId, resourceName }) => {
    const bus: CfnResource = {
      Type: "AWS::Events::EventBus",
      Properties: { Name: resourceName },
      Metadata: { Overhead: "Rules and targets are not generated · add them for your events." },
    };
    if (s.resourcePolicy === true) {
      bus.Properties.Policy = {
        Version: "2012-10-17",
        Statement: [
          {
            Sid: "OverheadCrossAccountPlaceholder",
            Effect: "Allow",
            Principal: { AWS: { "Fn::Sub": "arn:aws:iam::${AWS::AccountId}:root" } },
            Action: "events:PutEvents",
            Resource: { "Fn::GetAtt": [logicalId, "Arn"] },
          },
        ],
      };
      bus.Metadata = { Overhead: "Resource policy is a same-account placeholder · name the accounts you actually trust." };
    }
    return [bus];
  },
  fromCfn: (p) => (p.Policy ? { resourcePolicy: true } : {}),
  price: (s, traffic, pricing) => {
    const events = num(s.eventsPerMonth, traffic.requestsPerMonth);
    return [line(price(pricing, "eventbridge.customEvents"), events)];
  },
});
