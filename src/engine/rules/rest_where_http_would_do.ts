import type { Rule } from "./index";
import { price } from "../pricing";
import { byService, effective, requestsOf, saving } from "./util";

export const restWhereHttpWouldDo: Rule = (snapshot, pricing) =>
  byService(snapshot, "apigateway").flatMap((node) => {
    const s = effective(node);
    if (s.apiType !== "REST") return [];
    if (s.usagePlans === true || s.requestValidation === true || s.wafAttached === true)
      return [];
    const requests = requestsOf(s, "requestsPerMonth", snapshot.traffic);
    const delta =
      requests *
      (price(pricing, "apigateway.restRequests").rate -
        price(pricing, "apigateway.httpRequests").rate);
    return [
      {
        rule: "rest_where_http_would_do",
        severity: "warn" as const,
        message: `${node.name} is a REST API but uses no REST-only feature (usage plans, request validation, WAF). An HTTP API serves the same routes at ~70% lower request price.`,
        docUrl: "https://aws.amazon.com/api-gateway/pricing/",
        nodeIds: [node.id],
        estimatedSaving: saving(delta),
      },
    ];
  });
