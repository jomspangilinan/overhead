import { defineService } from "../defineService";
import { price } from "../pricing";
import { line, num } from "./util";

export const cloudfront = defineService({
  id: "cloudfront",
  term: "Amazon CloudFront",
  icon: "aws-cloudfront",
  lane: "ingress",
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
  },
  cardLines: ["dataOutGbPerMonth", "requestsPerMonth"],
  cdk: (s, { varName, resourceName }) => {
    const pc =
      s.priceClass === "PriceClass_100"
        ? "PRICE_CLASS_100"
        : s.priceClass === "PriceClass_200"
          ? "PRICE_CLASS_200"
          : "PRICE_CLASS_ALL";
    return `// distribution "${resourceName}" — stub origin, point at your real one
new cloudfront.Distribution(this, "${varName}", {
  defaultBehavior: { origin: new origins.HttpOrigin("origin.example.com") },
  priceClass: cloudfront.PriceClass.${pc},
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
