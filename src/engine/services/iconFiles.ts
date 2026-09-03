// The icon file behind each node, as it is served.
//
// `ServiceDef.icon` is a *sprite symbol* id (`aws-lambda`), which only means
// anything inside a page that has injected our sprite. A Mermaid document is
// read somewhere else by definition, so the icon has to arrive as a URL to a
// standalone file.
//
// Both families are here and both are links, so an exported document looks
// like one thing rather than two. The AWS icons are the `Arch_*_64.svg`
// files straight out of the AWS icon package; the flow shapes are ours,
// written to `public/icons/flow/` from the one drawing in `flowShapes.ts`
// (`npm run flow-icons`, asserted by `tests/flow-icons.test.ts` so the file
// and the canvas can never disagree).

import type { ServiceId } from "../model";

/** The origin the files are served from · the default when the exporter is
 *  not told one, because a document exported from localhost would otherwise
 *  carry links nobody else can resolve. */
export const ICON_BASE = "https://overhead-ecru.vercel.app";

/** Service id → path under the site root. */
export const ICON_FILE: Partial<Record<ServiceId, string>> = {
  apigateway: "icons/aws/Arch_Amazon-API-Gateway_64.svg",
  cloudfront: "icons/aws/Arch_Amazon-CloudFront_64.svg",
  cloudwatchlogs: "icons/aws/Arch_Amazon-CloudWatch_64.svg",
  cognito: "icons/aws/Arch_Amazon-Cognito_64.svg",
  dynamodb: "icons/aws/Arch_Amazon-DynamoDB_64.svg",
  eventbridge: "icons/aws/Arch_Amazon-EventBridge_64.svg",
  firehose: "icons/aws/Arch_Amazon-Data-Firehose_64.svg",
  kinesis: "icons/aws/Arch_Amazon-Kinesis-Data-Streams_64.svg",
  kms: "icons/aws/Arch_AWS-Key-Management-Service_64.svg",
  lambda: "icons/aws/Arch_AWS-Lambda_64.svg",
  s3: "icons/aws/Arch_Amazon-Simple-Storage-Service_64.svg",
  secretsmanager: "icons/aws/Arch_AWS-Secrets-Manager_64.svg",
  sns: "icons/aws/Arch_Amazon-Simple-Notification-Service_64.svg",
  sqs: "icons/aws/Arch_Amazon-Simple-Queue-Service_64.svg",
  ssmparameter: "icons/aws/Arch_AWS-Systems-Manager_64.svg",
  stepfunctions: "icons/aws/Arch_AWS-Step-Functions_64.svg",
  // Ours · one file per shape, same drawing the canvas uses.
  step: "icons/flow/step.svg",
  decision: "icons/flow/decision.svg",
  terminal: "icons/flow/terminal.svg",
  actor: "icons/flow/actor.svg",
  store: "icons/flow/store.svg",
  external: "icons/flow/external.svg",
};

/** The full URL for a node's icon, or null for a service added without one. */
export function iconUrl(service: string, base = ICON_BASE): string | null {
  const file = ICON_FILE[service as ServiceId];
  return file ? `${base.replace(/\/$/, "")}/${file}` : null;
}

/** The way back: which service an icon URL names · what lets a document
 *  carrying images be read even when its `%% overhead:` line is gone. */
export function serviceFromIconUrl(url: string): ServiceId | null {
  const clean = url.split(/[?#]/)[0];
  for (const [id, path] of Object.entries(ICON_FILE)) {
    if (clean.endsWith(path.slice(path.lastIndexOf("/")))) return id as ServiceId;
  }
  return null;
}
