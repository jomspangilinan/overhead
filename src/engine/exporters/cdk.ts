// CDK (TypeScript) export: one stack, one construct per node, derived from
// each service's defineService().cdk. The header lists every assumption
// and stub so the reader knows exactly what to replace.

import type { StateSnapshot } from "../model";
import type { PricingTable } from "../pricing";
import { monthlyTotal } from "../cost";
import { toMoney } from "../model";
import { defaultSettings } from "../defineService";
import { getService } from "../services";
import { cdkStateComment, overheadStateBlock } from "./overheadState";

const IMPORTS: Record<string, string> = {
  lambda: 'import * as lambda from "aws-cdk-lib/aws-lambda";',
  apigateway:
    'import * as apigateway from "aws-cdk-lib/aws-apigateway";\nimport * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";',
  dynamodb: 'import * as dynamodb from "aws-cdk-lib/aws-dynamodb";',
  s3: 'import * as s3 from "aws-cdk-lib/aws-s3";',
  cloudfront:
    'import * as cloudfront from "aws-cdk-lib/aws-cloudfront";\nimport * as origins from "aws-cdk-lib/aws-cloudfront-origins";',
  sqs: 'import * as sqs from "aws-cdk-lib/aws-sqs";',
  sns: 'import * as sns from "aws-cdk-lib/aws-sns";',
  eventbridge: 'import * as events from "aws-cdk-lib/aws-events";',
  stepfunctions: 'import * as sfn from "aws-cdk-lib/aws-stepfunctions";',
  cognito: 'import * as cognito from "aws-cdk-lib/aws-cognito";',
  kinesis: 'import * as kinesis from "aws-cdk-lib/aws-kinesis";',
  firehose: 'import * as firehose from "aws-cdk-lib/aws-kinesisfirehose";',
  kms: 'import * as kms from "aws-cdk-lib/aws-kms";',
  secretsmanager: 'import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";',
  ssmparameter: 'import * as ssm from "aws-cdk-lib/aws-ssm";',
  cloudwatchlogs: 'import * as logs from "aws-cdk-lib/aws-logs";',
};

/** Every name the generated file already binds · a construct variable that
 *  collides with one of these shadows the import and the stack fails at
 *  `new secretsmanager.Secret(...)` with "cannot access before
 *  initialization". A node called "logs" or "lambda" is entirely ordinary,
 *  so the collision is resolved here rather than forbidden upstream. */
const RESERVED = new Set([
  "cdk",
  "Construct",
  "lambda",
  "apigateway",
  "apigwv2",
  "dynamodb",
  "s3",
  "cloudfront",
  "origins",
  "sqs",
  "sns",
  "events",
  "sfn",
  "cognito",
  "kinesis",
  "firehose",
  "kms",
  "secretsmanager",
  "ssm",
  "logs",
  "this",
  "props",
  "scope",
  "id",
]);

function camel(id: string): string {
  return id
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((w, i) => (i ? w[0].toUpperCase() + w.slice(1) : w))
    .join("")
    .replace(/^([0-9])/, "n$1");
}

/** Unique, non-shadowing variable names, one per node id. */
function varNames(ids: string[]): Map<string, string> {
  const out = new Map<string, string>();
  const used = new Set(RESERVED);
  for (const id of ids) {
    const base = camel(id) || "resource";
    let name = RESERVED.has(base) ? `${base}Resource` : base;
    let n = 2;
    while (used.has(name)) name = `${base}${n++}`;
    used.add(name);
    out.set(id, name);
  }
  return out;
}

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 60) || "resource";
}

export function exportCdk(
  snapshot: StateSnapshot,
  pricing: PricingTable,
  stackName = "OverheadStack",
): string {
  const services = [...new Set(snapshot.nodes.map((n) => n.service))];
  const imports = services
    .map((s) => IMPORTS[s])
    .filter(Boolean)
    .join("\n");

  const names = varNames(snapshot.nodes.map((n) => n.id));
  const blocks = snapshot.nodes
    .map((node) => {
      const def = getService(node.service);
      if (!def?.cdk) return `// ${node.name}: no CDK mapping`;
      const settings = { ...defaultSettings(def), ...node.settings };
      const code = def.cdk(settings, {
        varName: names.get(node.id)!,
        resourceName: safeName(node.name),
      });
      return `// ── ${def.term}: ${node.name}\n${code}`;
    })
    .join("\n\n")
    .split("\n")
    .map((l) => (l ? `    ${l}` : l))
    .join("\n");

  const total = toMoney(monthlyTotal(snapshot, pricing)).toFixed(2);
  const unmapped = snapshot.nodes.filter((n) => !getService(n.service)?.cdk).map((n) => n.name);
  // The stack the reader gets is a view of the drawing, and a view is lossy:
  // positions, containers, sections and the traffic the estimate runs on have
  // nowhere to live in TypeScript. They ride along in a comment, which is why
  // a stack Overhead wrote can be imported back and anyone else's cannot.
  const state = cdkStateComment(
    overheadStateBlock(snapshot, pricing, {
      drawing: stackName,
      idFor: (id) => ({ varName: names.get(id) }),
      stubs: [
        "Wiring between constructs (permissions, event sources, targets) is not generated.",
        "Lambda code is an inline stub; DynamoDB tables get a stub \"pk\" key; CloudFront points at a placeholder origin.",
        ...(unmapped.length ? [`No CDK mapping: ${unmapped.join(", ")}.`] : []),
      ],
    }),
  );

  return `// Generated by Overhead — https://overhead-ecru.vercel.app
// Estimated monthly cost: $${total} (AWS Price List, ${pricing.region}, fetched ${pricing.generatedAt.slice(0, 10)})
//
// Assumptions and stubs to replace before deploying:
//   - Lambda handlers are inline stubs; wire real code assets.
//   - DynamoDB tables get a stub "pk" string partition key.
//   - CloudFront distributions point at a placeholder HTTP origin.
//   - REST APIs carry one mock ANY method so the stack synthesizes.
//   - Step Functions state machines hold a single Pass state.
//   - Wiring between constructs (permissions, event sources, targets)
//     is not generated — connect them for your use case.

import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
${imports}

export class ${stackName} extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

${blocks}
  }
}

${state}`;
}
