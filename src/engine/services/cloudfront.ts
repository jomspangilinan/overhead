import { defineService } from "../defineService";
import { price } from "../pricing";
import { line, num } from "./util";

export const cloudfront = defineService({
  id: "cloudfront",
  term: "Amazon CloudFront",
  icon: "aws-cloudfront",
  role: "ingress",
  settings: {
    dataOutGbPerMonth: {
      type: "number",
      min: 0,
      optional: true,
      label: "Data out (GB / month)",
      driver: true,
      description: "Defaults to traffic requests × payload size",
    },
    requestsPerMonth: {
      type: "number",
      min: 0,
      optional: true,
      label: "HTTPS requests / month",
      driver: true,
      description: "Defaults to the canvas traffic figure",
    },
    priceClass: {
      type: "enum",
      values: ["PriceClass_All", "PriceClass_200", "PriceClass_100"],
      default: "PriceClass_All",
      label: "Price class",
    },
    originAccess: {
      type: "enum",
      values: ["oac", "public-origin"],
      default: "oac",
      label: "Origin access",
      description: "Origin access control keeps the origin private",
      group: "security",
    },
    minTls: {
      type: "enum",
      values: ["TLSv1.2_2021", "TLSv1.2_2019", "TLSv1"],
      default: "TLSv1.2_2021",
      label: "Minimum TLS",
      group: "security",
    },
  },
  badge: (s) => `${s.originAccess === "public-origin" ? "public origin" : "OAC"} · ${s.minTls === "TLSv1" ? "TLS1.0!" : "TLS1.2"}`,
  cardLines: ["dataOutGbPerMonth", "requestsPerMonth"],
  cdk: (s, { varName, resourceName }) => {
    const pc =
      s.priceClass === "PriceClass_100"
        ? "PRICE_CLASS_100"
        : s.priceClass === "PriceClass_200"
          ? "PRICE_CLASS_200"
          : "PRICE_CLASS_ALL";
    const tls = s.minTls === "TLSv1" ? "TLS_V1" : s.minTls === "TLSv1.2_2019" ? "TLS_V1_2_2019" : "TLS_V1_2_2021";
    const oac = s.originAccess === "public-origin" ? "" : "\n  // origin access: use origins.S3BucketOrigin.withOriginAccessControl(bucket) for an S3 origin";
    return `// distribution "${resourceName}" — stub origin, point at your real one
new cloudfront.Distribution(this, "${varName}", {${oac}
  defaultBehavior: { origin: new origins.HttpOrigin("origin.example.com") },
  priceClass: cloudfront.PriceClass.${pc},
  minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.${tls},
});`;
  },
  price: (s, traffic, pricing) => {
    const defaultGb =
      (traffic.requestsPerMonth * traffic.avgPayloadKb) / (1024 * 1024);
    const dataOutGb = num(s.dataOutGbPerMonth, defaultGb);
    const requests = num(s.requestsPerMonth, traffic.requestsPerMonth);
    return [
      line(price(pricing, "cloudfront.dataOutGb"), dataOutGb),
      line(price(pricing, "cloudfront.httpsRequests"), requests),
    ];
  },
});
