import { defineService } from "../defineService";
import { price } from "../pricing";
import { line, num } from "./util";

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
  price: (s, traffic, pricing) => {
    const events = num(s.eventsPerMonth, traffic.requestsPerMonth);
    return [line(price(pricing, "eventbridge.customEvents"), events)];
  },
});
