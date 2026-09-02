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
    encryption: {
      type: "enum",
      values: ["sse-sqs", "sse-kms"],
      default: "sse-sqs",
      label: "Encryption at rest",
      group: "security",
    },
    dlqConfigured: {
      type: "boolean",
      default: false,
      label: "Dead-letter queue",
    },
  },
  cardLines: ["queueType", "requestsPerMonth"],
  badge: (s) => (s.encryption === "sse-kms" ? "SSE-KMS" : "SSE-SQS"),
  cdk: (s, { varName, resourceName }) => {
    const fifo = s.queueType === "fifo";
    const suffix = fifo ? ".fifo" : "";
    const enc = `\n  encryption: sqs.QueueEncryption.${s.encryption === "sse-kms" ? "KMS_MANAGED" : "SQS_MANAGED"},`;
    const fifoProp = (fifo ? "\n  fifo: true," : "") + enc;
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
