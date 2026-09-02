import { defineService } from "../defineService";
import { price } from "../pricing";
import { defined, line, num, roleResource } from "./util";

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
  cfnTypes: ["AWS::Lambda::Function"],
  cfn: (s, { logicalId, resourceName }) => {
    const broad = s.iamRole === "broad";
    const role = roleResource(
      "Role",
      "lambda.amazonaws.com",
      broad
        ? ["arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole", "arn:aws:iam::aws:policy/PowerUserAccess"]
        : ["arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"],
    );
    role.Metadata = {
      Overhead: broad
        ? "Execution role: a shared broad role was chosen on the canvas · scope this down before deploying."
        : "Execution role: least-privilege · add the exact actions this function needs.",
    };
    const props: Record<string, unknown> = {
      FunctionName: resourceName,
      Runtime: "nodejs20.x",
      Handler: "index.handler",
      Architectures: [s.architecture === "x86_64" ? "x86_64" : "arm64"],
      MemorySize: num(s.memoryMb, 512),
      Timeout: num(s.timeoutSec, 3),
      Role: { "Fn::GetAtt": [`${logicalId}Role`, "Arn"] },
      Code: { ZipFile: "exports.handler = async () => ({ statusCode: 200 });" },
    };
    if (typeof s.reservedConcurrency === "number") props.ReservedConcurrentExecutions = s.reservedConcurrency;
    if (s.envEncryption === "customer-managed") {
      props.Environment = { Variables: {} };
    }
    return [
      role,
      {
        Type: "AWS::Lambda::Function",
        Properties: props,
        DependsOn: [`${logicalId}Role`],
        Metadata: {
          Overhead: [
            "Code is an inline stub · replace with your asset.",
            s.vpcAttached === true ? "VpcConfig: attach subnets and a security group once the VPC exists." : null,
            s.envEncryption === "customer-managed" ? "KmsKeyArn: point at your customer-managed key." : null,
          ]
            .filter(Boolean)
            .join(" "),
        },
      },
    ];
  },
  fromCfn: (p) => {
    const arch = Array.isArray(p.Architectures) ? String(p.Architectures[0]) : undefined;
    return defined({
      architecture: arch === "x86_64" ? "x86_64" : arch === "arm64" ? "arm64" : undefined,
      memoryMb: typeof p.MemorySize === "number" ? p.MemorySize : undefined,
      timeoutSec: typeof p.Timeout === "number" ? p.Timeout : undefined,
      reservedConcurrency:
        typeof p.ReservedConcurrentExecutions === "number" ? p.ReservedConcurrentExecutions : undefined,
      vpcAttached: p.VpcConfig ? true : undefined,
      dlqConfigured: p.DeadLetterConfig ? true : undefined,
      envEncryption: p.KmsKeyArn ? "customer-managed" : undefined,
    });
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
