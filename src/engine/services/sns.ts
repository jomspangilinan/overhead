import { defineService } from "../defineService";
import { price } from "../pricing";
import { line, num } from "./util";

export const sns = defineService({
  id: "sns",
  term: "Amazon SNS",
  icon: "aws-sns",
  role: "messaging",
  settings: {
    publishesPerMonth: {
      type: "number",
      min: 0,
      optional: true,
      label: "Publishes / month",
      driver: true,
      description: "Defaults to the canvas traffic figure",
    },
    subscriberCount: {
      type: "number",
      min: 0,
      default: 1,
      label: "Subscribers",
      description: "Deliveries to SQS and Lambda are free",
    },
  },
  cardLines: ["publishesPerMonth", "subscriberCount"],
  cdk: (_s, { varName, resourceName }) =>
    `new sns.Topic(this, "${varName}", { topicName: "${resourceName}" });`,
  price: (s, traffic, pricing) => {
    const publishes = num(s.publishesPerMonth, traffic.requestsPerMonth);
    return [line(price(pricing, "sns.requests"), publishes)];
  },
});
