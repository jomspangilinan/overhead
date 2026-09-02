import { defineService } from "../defineService";
import { price } from "../pricing";
import { HOURS_PER_MONTH, defined, line, num } from "./util";

export const dynamodb = defineService({
  id: "dynamodb",
  term: "Amazon DynamoDB",
  icon: "aws-dynamodb",
  role: "data",
  settings: {
    capacityMode: {
      type: "enum",
      values: ["on-demand", "provisioned"],
      default: "on-demand",
      label: "Capacity mode",
      driver: true,
    },
    storageGb: {
      type: "number",
      min: 0,
      default: 5,
      label: "Storage (GB)",
      driver: true,
    },
    readsPerMonth: {
      type: "number",
      min: 0,
      optional: true,
      label: "Reads / month",
      driver: true,
      description: "Defaults to the canvas traffic figure",
    },
    writesPerMonth: {
      type: "number",
      min: 0,
      optional: true,
      label: "Writes / month",
      driver: true,
      description: "Defaults to 25% of the canvas traffic figure",
    },
    provisionedRcu: {
      type: "number",
      min: 1,
      default: 5,
      label: "Provisioned RCU",
      driver: true,
    },
    provisionedWcu: {
      type: "number",
      min: 1,
      default: 5,
      label: "Provisioned WCU",
      driver: true,
    },
    encryption: {
      type: "enum",
      values: ["aws-owned", "aws-managed", "customer-managed"],
      default: "aws-owned",
      label: "Encryption at rest",
      description: "AWS-owned key, AWS-managed KMS key, or your own CMK",
      group: "security",
    },
    pitr: {
      type: "boolean",
      default: false,
      label: "Point-in-time recovery",
      group: "security",
    },
  },
  badge: (s) =>
    [s.encryption === "customer-managed" ? "SSE-KMS (CMK)" : s.encryption === "aws-managed" ? "SSE-KMS" : "SSE", s.pitr === true ? "PITR" : null]
      .filter(Boolean)
      .join(" · "),
  cardLines: ["capacityMode", "storageGb", "readsPerMonth"],
  cdk: (s, { varName, resourceName }) => {
    const provisioned = s.capacityMode === "provisioned";
    const capacity = provisioned
      ? `\n  readCapacity: ${Number(s.provisionedRcu) || 5},\n  writeCapacity: ${Number(s.provisionedWcu) || 5},`
      : "";
    const enc =
      s.encryption === "customer-managed" ? "CUSTOMER_MANAGED" : s.encryption === "aws-managed" ? "AWS_MANAGED" : "DEFAULT";
    const pitr = s.pitr === true ? "\n  pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true }," : "";
    return `new dynamodb.Table(this, "${varName}", {
  tableName: "${resourceName}",
  encryption: dynamodb.TableEncryption.${enc},${pitr}
  // stub key schema · set your real partition/sort keys
  partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.${provisioned ? "PROVISIONED" : "PAY_PER_REQUEST"},${capacity}
});`;
  },
  cfnTypes: ["AWS::DynamoDB::Table"],
  cfn: (s, { resourceName }) => {
    const provisioned = s.capacityMode === "provisioned";
    const props: Record<string, unknown> = {
      TableName: resourceName,
      AttributeDefinitions: [{ AttributeName: "pk", AttributeType: "S" }],
      KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }],
      BillingMode: provisioned ? "PROVISIONED" : "PAY_PER_REQUEST",
    };
    if (provisioned) {
      props.ProvisionedThroughput = {
        ReadCapacityUnits: num(s.provisionedRcu, 5),
        WriteCapacityUnits: num(s.provisionedWcu, 5),
      };
    }
    if (s.encryption !== "aws-owned") {
      props.SSESpecification = { SSEEnabled: true, SSEType: "KMS" };
    }
    if (s.pitr === true) props.PointInTimeRecoverySpecification = { PointInTimeRecoveryEnabled: true };
    return [
      {
        Type: "AWS::DynamoDB::Table",
        Properties: props,
        Metadata: { Overhead: "Key schema is a stub · set your real partition and sort keys." },
      },
    ];
  },
  fromCfn: (p) => {
    const tp = p.ProvisionedThroughput as { ReadCapacityUnits?: number; WriteCapacityUnits?: number } | undefined;
    const sse = p.SSESpecification as { SSEEnabled?: boolean; KMSMasterKeyId?: unknown } | undefined;
    const pitr = p.PointInTimeRecoverySpecification as { PointInTimeRecoveryEnabled?: boolean } | undefined;
    const mode = typeof p.BillingMode === "string" ? p.BillingMode : tp ? "PROVISIONED" : undefined;
    return defined({
      capacityMode: mode === "PROVISIONED" ? "provisioned" : mode === "PAY_PER_REQUEST" ? "on-demand" : undefined,
      provisionedRcu: typeof tp?.ReadCapacityUnits === "number" ? tp.ReadCapacityUnits : undefined,
      provisionedWcu: typeof tp?.WriteCapacityUnits === "number" ? tp.WriteCapacityUnits : undefined,
      encryption: sse?.SSEEnabled ? (sse.KMSMasterKeyId ? "customer-managed" : "aws-managed") : undefined,
      pitr: pitr ? pitr.PointInTimeRecoveryEnabled === true : undefined,
    });
  },
  price: (s, traffic, pricing) => {
    const storageGb = num(s.storageGb, 5);
    const lines = [line(price(pricing, "dynamodb.storageGbMonth"), storageGb)];
    if (s.capacityMode === "provisioned") {
      const rcuHours = num(s.provisionedRcu, 5) * HOURS_PER_MONTH;
      const wcuHours = num(s.provisionedWcu, 5) * HOURS_PER_MONTH;
      lines.push(
        line(price(pricing, "dynamodb.rcuHour"), rcuHours),
        line(price(pricing, "dynamodb.wcuHour"), wcuHours),
      );
    } else {
      const reads = num(s.readsPerMonth, traffic.requestsPerMonth);
      const writes = num(s.writesPerMonth, traffic.requestsPerMonth * 0.25);
      lines.push(
        line(price(pricing, "dynamodb.onDemandRead"), reads),
        line(price(pricing, "dynamodb.onDemandWrite"), writes),
      );
    }
    return lines;
  },
});
