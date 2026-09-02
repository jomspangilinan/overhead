import { defineService } from "../defineService";
import { price } from "../pricing";
import { line, num } from "./util";

export const sqs = defineService({
  id: "sqs",
  term: "Amazon SQS",
  icon: "aws-sqs",
  role: "messaging",
  settings: {
    queueType: {
      type: "enum",
      values: ["standard", "fifo"],
      default: "standard",
      label: "Queue type",
      driver: true,
    },
    requestsPerMonth: {
      type: "number",
      min: 0,
      optional: true,
      label: "Requests / month",
      driver: true,
      description: "Defaults to the canvas traffic figure",
    },
    dlqConfigured: {
      type: "boolean",
      default: false,
      label: "Dead-letter queue",
    },
  },
  cardLines: ["queueType", "requestsPerMonth"],
  cdk: (s, { varName, resourceName }) => {
    const fifo = s.queueType === "fifo";
    const suffix = fifo ? ".fifo" : "";
    const fifoProp = fifo ? "\n  fifo: true," : "";
    if (s.dlqConfigured === true) {
      return `const ${varName}Dlq = new sqs.Queue(this, "${varName}Dlq", {
  queueName: "${resourceName}-dlq${suffix}",${fifoProp}
});
new sqs.Queue(this, "${varName}", {
  queueName: "${resourceName}${suffix}",${fifoProp}
  deadLetterQueue: { queue: ${varName}Dlq, maxReceiveCount: 3 },
});`;
    }
    return `new sqs.Queue(this, "${varName}", {
  queueName: "${resourceName}${suffix}",${fifoProp}
});`;
  },
  price: (s, traffic, pricing) => {
    const requests = num(s.requestsPerMonth, traffic.requestsPerMonth);
    const key = s.queueType === "fifo" ? "sqs.fifoRequests" : "sqs.requests";
    return [line(price(pricing, key), requests)];
  },
});
