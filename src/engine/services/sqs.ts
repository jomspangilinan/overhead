import { defineService } from "../defineService";
import { price } from "../pricing";
import { defined, line, num } from "./util";

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
  cfnTypes: ["AWS::SQS::Queue"],
  cfn: (s, { logicalId, resourceName }) => {
    const fifo = s.queueType === "fifo";
    const suffix = fifo ? ".fifo" : "";
    const base: Record<string, unknown> = {
      ...(fifo ? { FifoQueue: true } : {}),
      ...(s.encryption === "sse-kms"
        ? { KmsMasterKeyId: "alias/aws/sqs" }
        : { SqsManagedSseEnabled: true }),
    };
    const out = [];
    if (s.dlqConfigured === true) {
      out.push({
        suffix: "Dlq",
        Type: "AWS::SQS::Queue",
        Properties: { QueueName: `${resourceName}-dlq${suffix}`, ...base },
      });
    }
    out.push({
      Type: "AWS::SQS::Queue",
      Properties: {
        QueueName: `${resourceName}${suffix}`,
        ...base,
        ...(s.dlqConfigured === true
          ? {
              RedrivePolicy: {
                deadLetterTargetArn: { "Fn::GetAtt": [`${logicalId}Dlq`, "Arn"] },
                maxReceiveCount: 3,
              },
            }
          : {}),
      },
    });
    return out;
  },
  fromCfn: (p) => {
    return defined({
      queueType: p.FifoQueue === true ? "fifo" : undefined,
      encryption: p.KmsMasterKeyId ? "sse-kms" : p.SqsManagedSseEnabled === true ? "sse-sqs" : undefined,
      dlqConfigured: p.RedrivePolicy ? true : undefined,
    });
  },
  price: (s, traffic, pricing) => {
    const requests = num(s.requestsPerMonth, traffic.requestsPerMonth);
    const key = s.queueType === "fifo" ? "sqs.fifoRequests" : "sqs.requests";
    return [line(price(pricing, key), requests)];
  },
});
