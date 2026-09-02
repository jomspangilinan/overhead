import { defineService } from "../defineService";
import { price } from "../pricing";
import { line, num } from "./util";

export const apigateway = defineService({
  id: "apigateway",
  term: "Amazon API Gateway",
  icon: "aws-apigateway",
  role: "ingress",
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
      group: "security",
    },
    auth: {
      type: "enum",
      values: ["none", "iam", "cognito", "lambda-authorizer"],
      default: "none",
      label: "Authorization",
      description: "Who may call the API",
      group: "security",
    },
  },
  cardLines: ["apiType", "requestsPerMonth"],
  badge: (s) =>
    [s.auth === "none" ? "no auth" : s.auth === "iam" ? "IAM auth" : s.auth === "cognito" ? "Cognito JWT" : "authorizer", s.wafAttached === true ? "WAF" : null]
      .filter(Boolean)
      .join(" · "),
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
