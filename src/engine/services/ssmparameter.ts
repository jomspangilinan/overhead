// Parameter Store · the cheap half of the configuration story. Standard
// parameters at standard throughput are free, which is the whole point of
// putting one here next to a Secrets Manager node: the diagram shows what
// each choice costs. Advanced parameters are $0.05 each per month, and
// higher throughput bills every interaction.

import { defineService } from "../defineService";
import { price } from "../pricing";
import { HOURS_PER_MONTH, defined, line, num } from "./util";

export const ssmparameter = defineService({
  id: "ssmparameter",
  term: "Parameter Store",
  icon: "aws-ssm",
  role: "data",
  settings: {
    tier: {
      type: "enum",
      values: ["standard", "advanced"],
      default: "standard",
      label: "Parameter tier",
      driver: true,
      description: "Standard is free up to 4 KB · advanced is 8 KB and $0.05 each per month",
    },
    parameters: {
      type: "number",
      min: 1,
      default: 10,
      label: "Parameters",
      driver: true,
    },
    throughput: {
      type: "enum",
      values: ["standard", "higher"],
      default: "standard",
      label: "Throughput",
      driver: true,
      description: "Higher throughput bills every interaction, on any tier",
    },
    apiRequestsPerMonth: {
      type: "number",
      min: 0,
      optional: true,
      label: "API interactions / month",
      driver: true,
      description: "Defaults to the canvas traffic figure",
    },
    secureString: {
      type: "boolean",
      default: false,
      label: "SecureString",
      description: "Encrypted with KMS · the key and its requests are priced on a KMS node",
      group: "security",
    },
  },
  cardLines: ["tier", "parameters", "throughput"],
  badge: (s) => (s.secureString === true ? "SecureString" : "plaintext"),
  cdk: (s, { varName, resourceName }) =>
    s.secureString === true
      ? `// "${resourceName}" is a SecureString · CDK cannot create one (CloudFormation will not
// accept the type), so create it out of band or use secretsmanager.Secret instead.
// new ssm.StringParameter(this, "${varName}", { parameterName: "${resourceName}", ... });`
      : `new ssm.StringParameter(this, "${varName}", {
  parameterName: "${resourceName}",
  tier: ssm.ParameterTier.${s.tier === "advanced" ? "ADVANCED" : "STANDARD"},
  stringValue: "replace-me", // stub
});`,
  cfnTypes: ["AWS::SSM::Parameter"],
  cfn: (s, { resourceName }) => [
    {
      Type: "AWS::SSM::Parameter",
      Properties: {
        Name: resourceName,
        Type: "String",
        Tier: s.tier === "advanced" ? "Advanced" : "Standard",
        Value: "replace-me",
      },
      Metadata: {
        Overhead:
          s.secureString === true
            ? "SecureString on the canvas · CloudFormation cannot create one, so this is a String. Create the secure value out of band."
            : "Value is a stub.",
      },
    },
  ],
  fromCfn: (p) =>
    defined({
      tier: p.Tier === "Advanced" ? "advanced" : p.Tier === "Standard" ? "standard" : undefined,
      secureString: p.Type === "SecureString" ? true : undefined,
    }),
  price: (s, traffic, pricing) => {
    const lines = [];
    if (s.tier === "advanced") {
      lines.push(line(price(pricing, "ssm.advancedParamHour"), num(s.parameters, 10) * HOURS_PER_MONTH));
    }
    // Interactions are free on the standard tier at standard throughput ·
    // that is the combination worth pointing at, so it charges nothing.
    if (s.tier === "advanced" || s.throughput === "higher") {
      lines.push(
        line(price(pricing, "ssm.paramApiRequests"), num(s.apiRequestsPerMonth, traffic.requestsPerMonth)),
      );
    }
    return lines;
  },
});
