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
      group: "security",
    },
    encryption: {
      type: "enum",
      values: ["sse-s3", "sse-kms"],
      default: "sse-s3",
      label: "Encryption at rest",
      group: "security",
    },
    blockPublicAccess: {
      type: "boolean",
      default: true,
      label: "Block public access",
      group: "security",
    },
    versioning: {
      type: "boolean",
      default: false,
      label: "Versioning",
      group: "security",
    },
  },
  badge: (s) =>
    [s.encryption === "sse-kms" ? "SSE-KMS" : "SSE-S3", s.blockPublicAccess === false ? "public" : null, s.versioning === true ? "versioned" : null]
      .filter(Boolean)
      .join(" · "),
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
    const enc = s.encryption === "sse-kms" ? "KMS_MANAGED" : "S3_MANAGED";
    const bpa = s.blockPublicAccess === false ? "" : "\n  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,";
    const versioned = s.versioning === true ? "\n  versioned: true," : "";
    return `// bucket for "${resourceName}" · names are global, so CDK generates one
new s3.Bucket(this, "${varName}", {${lifecycle}
  encryption: s3.BucketEncryption.${enc},${bpa}${versioned}
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
