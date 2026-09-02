import { defineService } from "../defineService";
import { price } from "../pricing";
import { line, num } from "./util";

export const lambda = defineService({
  id: "lambda",
  term: "AWS Lambda",
  icon: "aws-lambda",
  role: "handlers",
  settings: {
    architecture: {
      type: "enum",
      values: ["arm64", "x86_64"],
      default: "arm64",
      label: "Architecture",
      driver: true,
    },
    memoryMb: {
      type: "number",
      min: 128,
      max: 10240,
      default: 512,
      label: "Memory (MB)",
      driver: true,
    },
    timeoutSec: {
      type: "number",
      min: 1,
      max: 900,
      default: 3,
      label: "Timeout (s)",
    },
    avgDurationMs: {
      type: "number",
      min: 1,
      default: 200,
      label: "Avg duration (ms)",
      driver: true,
    },
    invocationsPerMonth: {
      type: "number",
      min: 0,
      optional: true,
      label: "Invocations / month",
      driver: true,
      description: "Defaults to the canvas traffic figure",
    },
    reservedConcurrency: {
      type: "number",
      min: 0,
      optional: true,
      label: "Reserved concurrency",
    },
    dlqConfigured: {
      type: "boolean",
      default: false,
      label: "DLQ / on-failure destination",
    },
    iamRole: {
      type: "enum",
      values: ["least-privilege", "broad"],
      default: "least-privilege",
      label: "Execution role",
      description: "Scoped per function, or a shared broad role",
      group: "security",
    },
    vpcAttached: {
      type: "boolean",
      default: false,
      label: "VPC-attached",
      description: "Runs inside a subnet (needs NAT for egress)",
      group: "security",
    },
    envEncryption: {
      type: "enum",
      values: ["aws-managed", "customer-managed"],
      default: "aws-managed",
      label: "Env-var encryption",
      group: "security",
    },
  },
  cardLines: ["architecture", "memoryMb", "avgDurationMs"],
  badge: (s) =>
    [s.iamRole === "broad" ? "broad IAM" : "IAM role", s.vpcAttached === true ? "VPC" : null, s.envEncryption === "customer-managed" ? "CMK" : null]
      .filter(Boolean)
      .join(" · "),
  cdk: (s, { varName, resourceName }) => {
    const arch = s.architecture === "x86_64" ? "X86_64" : "ARM_64";
    const reserved =
      typeof s.reservedConcurrency === "number"
        ? `\n  reservedConcurrentExecutions: ${s.reservedConcurrency},`
        : "";
    const secNotes = [
      s.iamRole === "broad" ? "  // execution role: a shared broad role was chosen · prefer a scoped role per function" : "  // execution role: least-privilege (CDK creates one scoped to this function)",
      s.vpcAttached === true ? "  // vpc: attach with `vpc` + `vpcSubnets` once the VPC construct exists" : null,
      s.envEncryption === "customer-managed" ? "  // environmentEncryption: pass a kms.Key here" : null,
    ]
      .filter(Boolean)
      .join("\n");
    return `new lambda.Function(this, "${varName}", {
${secNotes}
  functionName: "${resourceName}",
  runtime: lambda.Runtime.NODEJS_20_X,
  architecture: lambda.Architecture.${arch},
  memorySize: ${Number(s.memoryMb) || 512},
  timeout: cdk.Duration.seconds(${Number(s.timeoutSec) || 3}),${reserved}
  handler: "index.handler",
  // stub handler · replace with your code asset
  code: lambda.Code.fromInline("exports.handler = async () => ({ statusCode: 200 });"),
});`;
  },
  price: (s, traffic, pricing) => {
    const invocations = num(s.invocationsPerMonth, traffic.requestsPerMonth);
    const memoryGb = num(s.memoryMb, 512) / 1024;
    const durationSec = num(s.avgDurationMs, 200) / 1000;
    const gbSeconds = invocations * durationSec * memoryGb;
    const arch = s.architecture === "x86_64" ? "x86_64" : "arm64";
    return [
      line(price(pricing, "lambda.requests"), invocations),
      line(price(pricing, `lambda.gbSecond.${arch}`), gbSeconds),
    ];
  },
});
