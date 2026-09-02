import type { Rule } from "./index";
import { byService, effective } from "./util";

export const s3PublicNoCdn: Rule = (snapshot) =>
  byService(snapshot, "s3").flatMap((node) => {
    const s = effective(node);
    if (s.publiclyServed !== true) return [];
    const hasCdn = snapshot.edges.some((e) => {
      if (e.to !== node.id) return false;
      const from = snapshot.nodes.find((n) => n.id === e.from);
      return from?.service === "cloudfront";
    });
    if (hasCdn) return [];
    return [
      {
        rule: "s3_public_no_cdn",
        severity: "warn" as const,
        message: `${node.name} serves public traffic straight from the bucket. CloudFront in front caches at the edge, cuts S3 request and transfer charges, and is the supported pattern for public assets.`,
        docUrl:
          "https://docs.aws.amazon.com/AmazonS3/latest/userguide/website-hosting-cloudfront-walkthrough.html",
        nodeIds: [node.id],
      },
    ];
  });
