// AWS Secrets Manager · $0.40 per secret per month and $0.05 per 10,000 API
// calls. The per-secret charge is the one that surprises people: a hundred
// secrets is $40/month before a single call, which is the whole argument
// for Parameter Store when a value is not really a secret.

import { defineService } from "../defineService";
import { price } from "../pricing";
import { defined, line, num } from "./util";

export const secretsmanager = defineService({
  id: "secretsmanager",
  term: "AWS Secrets Manager",
  icon: "aws-secretsmanager",
  role: "data",
  settings: {
    secrets: {
      type: "number",
      min: 1,
      default: 1,
      label: "Secrets",
      driver: true,
    },
    apiRequestsPerMonth: {
      type: "number",
      min: 0,
      optional: true,
      label: "API calls / month",
      driver: true,
      description: "GetSecretValue and friends · defaults to the canvas traffic figure",
    },
    cached: {
      type: "boolean",
      default: true,
      label: "Cached in the client",
      description: "The AWS caching client fetches once per lifetime, not per invocation",
    },
    rotationDays: {
      type: "number",
      min: 0,
      optional: true,
      label: "Rotation (days)",
      description: "Rotation runs a Lambda · that function is priced on its own node",
      group: "security",
    },
    encryption: {
      type: "enum",
      values: ["aws-managed", "customer-managed"],
      default: "aws-managed",
      label: "Encryption key",
      group: "security",
    },
  },
  cardLines: ["secrets", "apiRequestsPerMonth", "cached"],
  badge: (s) =>
    [s.encryption === "customer-managed" ? "CMK" : "aws/secretsmanager", typeof s.rotationDays === "number" && s.rotationDays > 0 ? `rotates ${s.rotationDays}d` : "no rotation"]
      .filter(Boolean)
      .join(" · "),
  cdk: (s, { varName, resourceName }) => {
    const rotation =
      typeof s.rotationDays === "number" && s.rotationDays > 0
        ? `\n// rotation every ${s.rotationDays} days · attach with ${varName}.addRotationSchedule(...)`
        : "";
    return `const ${varName} = new secretsmanager.Secret(this, "${varName}", {
  secretName: "${resourceName}",${s.encryption === "customer-managed" ? "\n  // encryptionKey: pass a kms.Key here" : ""}
  generateSecretString: {}, // stub · replace with your value or leave to rotation
});${rotation}`;
  },
  cfnTypes: ["AWS::SecretsManager::Secret"],
  cfn: (s, { resourceName }) => [
    {
      Type: "AWS::SecretsManager::Secret",
      Properties: {
        Name: resourceName,
        GenerateSecretString: { PasswordLength: 32, ExcludePunctuation: true },
      },
      Metadata: {
        Overhead:
          (s.encryption === "customer-managed" ? "KmsKeyId: point at your key. " : "") +
          (typeof s.rotationDays === "number" && s.rotationDays > 0
            ? `Rotation every ${s.rotationDays} days needs a RotationSchedule and a rotation Lambda · not generated.`
            : "No rotation configured."),
      },
    },
  ],
  fromCfn: (p) =>
    defined({
      encryption: p.KmsKeyId ? "customer-managed" : undefined,
    }),
  price: (s, traffic, pricing) => {
    // A cached client fetches each secret about once per container lifetime,
    // not once per request · the default without caching is the traffic figure.
    const fallback = s.cached === true ? num(s.secrets, 1) * 720 : traffic.requestsPerMonth;
    return [
      line(price(pricing, "secretsmanager.secretMonth"), num(s.secrets, 1)),
      line(price(pricing, "secretsmanager.apiRequests"), num(s.apiRequestsPerMonth, fallback)),
    ];
  },
});
