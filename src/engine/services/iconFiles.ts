// The official icon file behind each AWS service, as it is served.
//
// `ServiceDef.icon` is a *sprite symbol* id (`aws-lambda`), which only means
// anything inside a page that has injected our sprite. A Mermaid document is
// read somewhere else by definition, so the icon has to arrive as a URL to a
// standalone file · these are the same `Arch_*_64.svg` files in
// `public/icons/aws/`, straight out of the AWS icon package.
//
// Only the `aws` family is here. A flow shape keeps its Mermaid bracket
// (`{}` a decision, `[( )]` a store) rather than becoming an image: those
// shapes are what a flowchart *is*, and every renderer already draws them.

import type { ServiceId } from "../model";

/** Where the files sit when the app is deployed · the fallback when the
 *  exporter is not told an origin (a document exported from localhost would
 *  otherwise carry links nobody else can resolve). */
export const ICON_BASE = "https://overhead-ecru.vercel.app/icons/aws";

export const ICON_FILE: Partial<Record<ServiceId, string>> = {
  apigateway: "Arch_Amazon-API-Gateway_64.svg",
  cloudfront: "Arch_Amazon-CloudFront_64.svg",
  cloudwatchlogs: "Arch_Amazon-CloudWatch_64.svg",
  cognito: "Arch_Amazon-Cognito_64.svg",
  dynamodb: "Arch_Amazon-DynamoDB_64.svg",
  eventbridge: "Arch_Amazon-EventBridge_64.svg",
  firehose: "Arch_Amazon-Data-Firehose_64.svg",
  kinesis: "Arch_Amazon-Kinesis-Data-Streams_64.svg",
  kms: "Arch_AWS-Key-Management-Service_64.svg",
  lambda: "Arch_AWS-Lambda_64.svg",
  s3: "Arch_Amazon-Simple-Storage-Service_64.svg",
  secretsmanager: "Arch_AWS-Secrets-Manager_64.svg",
  sns: "Arch_Amazon-Simple-Notification-Service_64.svg",
  sqs: "Arch_Amazon-Simple-Queue-Service_64.svg",
  ssmparameter: "Arch_AWS-Systems-Manager_64.svg",
  stepfunctions: "Arch_AWS-Step-Functions_64.svg",
};

/** The full URL for a service's icon, or null where there is no file (every
 *  flow shape, and any service added without one). */
export function iconUrl(service: string, base = ICON_BASE): string | null {
  const file = ICON_FILE[service as ServiceId];
  return file ? `${base.replace(/\/$/, "")}/${file}` : null;
}

/** The way back: which service an icon URL names · what lets a document
 *  carrying images be read even when its `%% overhead:` line is gone. */
export function serviceFromIconUrl(url: string): ServiceId | null {
  const file = url.split("/").pop();
  if (!file) return null;
  for (const [id, name] of Object.entries(ICON_FILE)) {
    if (name === file) return id as ServiceId;
  }
  return null;
}
