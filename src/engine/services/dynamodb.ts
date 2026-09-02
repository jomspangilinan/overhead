import { defineService } from "../defineService";
import { price } from "../pricing";
import { HOURS_PER_MONTH, line, num } from "./util";

export const dynamodb = defineService({
  id: "dynamodb",
  term: "Amazon DynamoDB",
  icon: "aws-dynamodb",
  lane: "data",
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
  },
  cardLines: ["capacityMode", "storageGb", "readsPerMonth"],
  cdk: (s, { varName, resourceName }) => {
    const provisioned = s.capacityMode === "provisioned";
    const capacity = provisioned
      ? `\n  readCapacity: ${Number(s.provisionedRcu) || 5},\n  writeCapacity: ${Number(s.provisionedWcu) || 5},`
      : "";
    return `new dynamodb.Table(this, "${varName}", {
  tableName: "${resourceName}",
  // stub key schema — set your real partition/sort keys
  partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.${provisioned ? "PROVISIONED" : "PAY_PER_REQUEST"},${capacity}
});`;
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
