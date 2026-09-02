import { defineService } from "../defineService";
import { price } from "../pricing";
import { defined, line, num } from "./util";

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
  cfnTypes: ["AWS::ApiGatewayV2::Api", "AWS::ApiGateway::RestApi"],
  cfn: (s, { logicalId, resourceName }) => {
    const authNote = `Auth on the canvas: ${String(s.auth ?? "none")}${s.wafAttached === true ? " · WAF attached (associate a WebACL)" : ""}.`;
    if (s.apiType === "REST") {
      return [
        {
          Type: "AWS::ApiGateway::RestApi",
          Properties: { Name: resourceName, EndpointConfiguration: { Types: ["REGIONAL"] } },
          Metadata: { Overhead: `Methods and integrations are not generated. ${authNote}` },
        },
        {
          suffix: "Deployment",
          Type: "AWS::ApiGateway::Deployment",
          Properties: { RestApiId: { Ref: logicalId }, StageName: "prod" },
          DependsOn: [logicalId],
          Metadata: { Overhead: "Deploys the API once you have added a method." },
        },
      ];
    }
    return [
      {
        Type: "AWS::ApiGatewayV2::Api",
        Properties: { Name: resourceName, ProtocolType: "HTTP" },
        Metadata: { Overhead: `Routes and integrations are not generated. ${authNote}` },
      },
      {
        suffix: "Stage",
        Type: "AWS::ApiGatewayV2::Stage",
        Properties: { ApiId: { Ref: logicalId }, StageName: "$default", AutoDeploy: true },
        DependsOn: [logicalId],
      },
    ];
  },
  fromCfn: (p, type) =>
    defined({
      apiType: type === "AWS::ApiGateway::RestApi" ? "REST" : p.ProtocolType === "HTTP" ? "HTTP" : undefined,
    }),
  price: (s, traffic, pricing) => {
    const requests = num(s.requestsPerMonth, traffic.requestsPerMonth);
    const key =
      s.apiType === "REST" ? "apigateway.restRequests" : "apigateway.httpRequests";
    return [line(price(pricing, key), requests)];
  },
});
