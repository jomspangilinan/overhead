// AWS KMS · the answer to "is encryption free?". It is not: a customer
// managed key is $1 per key version per month whatever it does, and every
// encrypt/decrypt/GenerateDataKey call is billed. An AWS managed key
// (aws/s3, aws/sqs …) costs nothing to hold, but its requests are still
// charged, which is why turning SSE-KMS on across a busy bucket shows up
// on a bill that used to say S3 only.

import { defineService } from "../defineService";
import { price } from "../pricing";
import { defined, line, num } from "./util";

export const kms = defineService({
  id: "kms",
  term: "AWS KMS",
  icon: "aws-kms",
  role: "data",
  settings: {
    keyType: {
      type: "enum",
      values: ["customer-managed", "aws-managed"],
      default: "customer-managed",
      label: "Key type",
      driver: true,
      description: "AWS managed keys are free to hold · their requests are not",
    },
    keys: {
      type: "number",
      min: 1,
      default: 1,
      label: "Keys",
      driver: true,
    },
    keyVersions: {
      type: "number",
      min: 1,
      default: 1,
      label: "Versions per key",
      driver: true,
      description: "Rotation keeps the old versions, and every version is billed",
    },
    requestsPerMonth: {
      type: "number",
      min: 0,
      optional: true,
      label: "Requests / month",
      driver: true,
      description: "Encrypt, Decrypt, GenerateDataKey · defaults to the canvas traffic figure",
    },
    rotation: {
      type: "boolean",
      default: true,
      label: "Automatic rotation",
      group: "security",
    },
    keyPolicy: {
      type: "enum",
      values: ["scoped", "account-wide"],
      default: "scoped",
      label: "Key policy",
      description: "Named principals, or the whole account via IAM",
      group: "security",
    },
  },
  cardLines: ["keyType", "keys", "requestsPerMonth"],
  badge: (s) =>
    [s.keyType === "aws-managed" ? "AWS managed" : "CMK", s.rotation === true ? "rotating" : null, s.keyPolicy === "account-wide" ? "account-wide" : null]
      .filter(Boolean)
      .join(" · "),
  cdk: (s, { varName, resourceName }) =>
    s.keyType === "aws-managed"
      ? `// "${resourceName}" is an AWS managed key · nothing to declare.
// Reference it where it is used, e.g. bucket encryption: s3.BucketEncryption.KMS_MANAGED.`
      : `new kms.Key(this, "${varName}", {
  alias: "${resourceName}",
  enableKeyRotation: ${s.rotation === true},
  // key policy: ${s.keyPolicy === "account-wide" ? "account-wide via IAM · scope this to the principals that need it" : "scoped · grant per principal with key.grantEncryptDecrypt()"}
});`,
  cfnTypes: ["AWS::KMS::Key"],
  cfn: (s, { logicalId, resourceName }) => {
    // An AWS managed key is created by the service that uses it · there is
    // nothing to declare, and inventing a resource would deploy a second key.
    if (s.keyType === "aws-managed") return [];
    return [
      {
        Type: "AWS::KMS::Key",
        Properties: {
          Description: resourceName,
          EnableKeyRotation: s.rotation === true,
          KeyPolicy: {
            Version: "2012-10-17",
            Statement: [
              {
                Sid: "EnableIamPolicies",
                Effect: "Allow",
                Principal: { AWS: { "Fn::Sub": "arn:aws:iam::${AWS::AccountId}:root" } },
                Action: "kms:*",
                Resource: "*",
              },
            ],
          },
        },
        Metadata: {
          Overhead:
            s.keyPolicy === "account-wide"
              ? "Key policy is account-wide, as chosen on the canvas · scope it to the principals that need the key."
              : "Key policy is the account root placeholder · add a statement per principal to make this scoped.",
        },
      },
      {
        suffix: "Alias",
        Type: "AWS::KMS::Alias",
        Properties: { AliasName: `alias/${resourceName}`, TargetKeyId: { Ref: logicalId } },
      },
    ];
  },
  fromCfn: (p) =>
    defined({
      keyType: "customer-managed",
      rotation: typeof p.EnableKeyRotation === "boolean" ? p.EnableKeyRotation : undefined,
    }),
  price: (s, traffic, pricing) => {
    const requests = num(s.requestsPerMonth, traffic.requestsPerMonth);
    const lines = [line(price(pricing, "kms.requests"), requests)];
    // AWS managed keys carry no monthly charge · only their requests.
    if (s.keyType !== "aws-managed") {
      lines.unshift(line(price(pricing, "kms.keyMonth"), num(s.keys, 1) * num(s.keyVersions, 1)));
    }
    return lines;
  },
});
