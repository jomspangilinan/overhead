import { defineService } from "../defineService";
import { price } from "../pricing";
import { defined, line, num, oneOf } from "./util";

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
    return `// distribution "${resourceName}" · stub origin, point at your real one
new cloudfront.Distribution(this, "${varName}", {${oac}
  defaultBehavior: { origin: new origins.HttpOrigin("origin.example.com") },
  priceClass: cloudfront.PriceClass.${pc},
  minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.${tls},
});`;
  },
  cfnTypes: ["AWS::CloudFront::Distribution"],
  cfn: (s, { resourceName }) => [
    {
      Type: "AWS::CloudFront::Distribution",
      Properties: {
        DistributionConfig: {
          Comment: resourceName,
          Enabled: true,
          PriceClass: oneOf(s.priceClass, ["PriceClass_All", "PriceClass_200", "PriceClass_100"] as const, "PriceClass_All"),
          Origins: [
            {
              Id: "overhead-origin",
              DomainName: "origin.example.com",
              CustomOriginConfig: { OriginProtocolPolicy: "https-only" },
            },
          ],
          DefaultCacheBehavior: {
            TargetOriginId: "overhead-origin",
            ViewerProtocolPolicy: "redirect-to-https",
            // CachingOptimized · the AWS managed cache policy
            CachePolicyId: "658327ea-f89d-4fab-a63d-7e88639e58f6",
          },
          ViewerCertificate: {
            CloudFrontDefaultCertificate: true,
            MinimumProtocolVersion: oneOf(s.minTls, ["TLSv1.2_2021", "TLSv1.2_2019", "TLSv1"] as const, "TLSv1.2_2021"),
          },
        },
      },
      Metadata: {
        Overhead: `Stub origin · point DomainName at your real one.${s.originAccess === "oac" ? " Origin access on the canvas is OAC: attach an OriginAccessControl for an S3 origin." : ""}`,
      },
    },
  ],
  fromCfn: (p) => {
    const c = (p.DistributionConfig ?? {}) as {
      PriceClass?: unknown;
      ViewerCertificate?: { MinimumProtocolVersion?: unknown };
      Origins?: { S3OriginConfig?: unknown; OriginAccessControlId?: unknown }[];
    };
    const origin = c.Origins?.[0];
    return defined({
      priceClass:
        typeof c.PriceClass === "string"
          ? oneOf(c.PriceClass, ["PriceClass_All", "PriceClass_200", "PriceClass_100"] as const, "PriceClass_All")
          : undefined,
      minTls:
        typeof c.ViewerCertificate?.MinimumProtocolVersion === "string"
          ? oneOf(c.ViewerCertificate.MinimumProtocolVersion, ["TLSv1.2_2021", "TLSv1.2_2019", "TLSv1"] as const, "TLSv1.2_2021")
          : undefined,
      originAccess: origin ? (origin.OriginAccessControlId || origin.S3OriginConfig ? "oac" : "public-origin") : undefined,
    });
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
