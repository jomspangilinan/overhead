import { defineService } from "../defineService";
import { price } from "../pricing";
import { line, num } from "./util";

export const s3 = defineService({
  id: "s3",
  term: "Amazon S3",
  icon: "aws-s3",
  lane: "data",
  settings: {
    storageGb: {
      type: "number",
      min: 0,
      default: 50,
      label: "Storage (GB)",
      driver: true,
    },
    putsPerMonth: {
      type: "number",
      min: 0,
      optional: true,
      label: "PUT requests / month",
      driver: true,
      description: "Defaults to 10% of the canvas traffic figure",
    },
    getsPerMonth: {
      type: "number",
      min: 0,
      optional: true,
      label: "GET requests / month",
      driver: true,
      description: "Defaults to the canvas traffic figure",
    },
    purpose: {
      type: "enum",
      values: ["assets", "uploads", "logs", "backup", "data-lake"],
      default: "assets",
      label: "Purpose",
      description: "Feeds findings, e.g. lifecycle rules on logs",
    },
    lifecycleRules: {
      type: "boolean",
      default: false,
      label: "Lifecycle rules",
    },
    publiclyServed: {
      type: "boolean",
      default: false,
      label: "Serves public traffic",
    },
  },
  cardLines: ["storageGb", "getsPerMonth", "purpose"],
  price: (s, traffic, pricing) => {
    const storageGb = num(s.storageGb, 50);
    const puts = num(s.putsPerMonth, traffic.requestsPerMonth * 0.1);
    const gets = num(s.getsPerMonth, traffic.requestsPerMonth);
    return [
      line(price(pricing, "s3.storageGbMonth"), storageGb),
      line(price(pricing, "s3.putRequests"), puts),
      line(price(pricing, "s3.getRequests"), gets),
    ];
  },
});
