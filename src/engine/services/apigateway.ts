import { defineService } from "../defineService";
import { price } from "../pricing";
import { line, num } from "./util";

export const apigateway = defineService({
  id: "apigateway",
  term: "Amazon API Gateway",
  icon: "aws-apigateway",
  lane: "ingress",
  settings: {
    apiType: {
      type: "enum",
      values: ["HTTP", "REST"],
      default: "HTTP",
      label: "API type",
      driver: true,
      description: "HTTP APIs cost ~70% less than REST APIs",
    },
    requestsPerMonth: {
      type: "number",
      min: 0,
      optional: true,
      label: "Requests / month",
      driver: true,
      description: "Defaults to the canvas traffic figure",
    },
    usagePlans: {
      type: "boolean",
      default: false,
      label: "Usage plans / API keys",
      description: "REST-only feature",
    },
    requestValidation: {
      type: "boolean",
      default: false,
      label: "Request validation",
      description: "REST-only feature",
    },
    wafAttached: {
      type: "boolean",
      default: false,
      label: "WAF attached",
      description: "REST-only feature",
    },
  },
  cardLines: ["apiType", "requestsPerMonth"],
  cdk: (s, { varName, resourceName }) =>
    s.apiType === "REST"
      ? `const ${varName} = new apigateway.RestApi(this, "${varName}", { restApiName: "${resourceName}" });
${varName}.root.addMethod("ANY", new apigateway.MockIntegration({
  integrationResponses: [{ statusCode: "200" }],
  requestTemplates: { "application/json": '{"statusCode": 200}' },
}), { methodResponses: [{ statusCode: "200" }] }); // stub integration`
      : `new apigwv2.HttpApi(this, "${varName}", { apiName: "${resourceName}" });`,
  price: (s, traffic, pricing) => {
    const requests = num(s.requestsPerMonth, traffic.requestsPerMonth);
    const key =
      s.apiType === "REST" ? "apigateway.restRequests" : "apigateway.httpRequests";
    return [line(price(pricing, key), requests)];
  },
});
