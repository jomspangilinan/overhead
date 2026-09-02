import { defineService } from "../defineService";
import { price } from "../pricing";
import { line, num } from "./util";

export const s3 = defineService({
  id: "s3",
  term: "Amazon S3",
  icon: "aws-s3",
  role: "data",
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
  cdk: (s, { varName, resourceName }) => {
    const lifecycle =
      s.lifecycleRules === true
        ? `\n  lifecycleRules: [{
    transitions: [{
      storageClass: s3.StorageClass.INFREQUENT_ACCESS,
      transitionAfter: cdk.Duration.days(90),
    }],
  }],`
        : "";
    return `// bucket for "${resourceName}" — names are global, so CDK generates one
new s3.Bucket(this, "${varName}", {${lifecycle}
  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
});`;
  },
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
