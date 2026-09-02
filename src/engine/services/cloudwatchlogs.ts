// CloudWatch Logs · the line item nobody draws and everybody pays. Every
// Lambda writes here whether or not it is on the diagram, and ingestion is
// $0.50 to $0.70 per GB, which routinely beats the compute it came from.
// Three charges, all of them here: ingest, what is kept, and what Logs
// Insights scans when you go looking.

import { defineService } from "../defineService";
import { price } from "../pricing";
import { defined, line, num } from "./util";

export const cloudwatchlogs = defineService({
  id: "cloudwatchlogs",
  term: "Amazon CloudWatch Logs",
  icon: "aws-cloudwatch",
  role: "data",
  settings: {
    ingestGbPerMonth: {
      type: "number",
      min: 0,
      default: 5,
      label: "Ingested (GB / month)",
      driver: true,
    },
    logClass: {
      type: "enum",
      values: ["standard", "infrequent-access"],
      default: "standard",
      label: "Log class",
      driver: true,
      description: "Infrequent Access is half the ingest price · no Live Tail, no metric filters",
    },
    retentionDays: {
      type: "number",
      min: 1,
      default: 30,
      label: "Retention (days)",
      driver: true,
      description: "Never expiring is the default on a new log group, and it is the usual bill surprise",
    },
    storedGbPerMonth: {
      type: "number",
      min: 0,
      optional: true,
      label: "Stored (GB / month)",
      driver: true,
      description: "Defaults to ingest × retention ÷ 30 · AWS compresses stored logs, so this is the ceiling",
    },
    insightsScannedGbPerMonth: {
      type: "number",
      min: 0,
      default: 0,
      label: "Insights scanned (GB / month)",
      driver: true,
      description: "Logs Insights bills every GB a query reads",
    },
    encryption: {
      type: "enum",
      values: ["aws-owned", "customer-managed"],
      default: "aws-owned",
      label: "Encryption at rest",
      group: "security",
    },
  },
  cardLines: ["ingestGbPerMonth", "retentionDays", "logClass"],
  badge: (s) => (s.encryption === "customer-managed" ? "CMK" : "AWS owned"),
  cdk: (s, { varName, resourceName }) => {
    const days = num(s.retentionDays, 30);
    // The CDK enum only has the retentions CloudWatch accepts.
    const allowed = [1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1096, 1827, 2192, 2557, 2922, 3288, 3653];
    const nearest = allowed.reduce((a, b) => (Math.abs(b - days) < Math.abs(a - days) ? b : a));
    const NAMES: Record<number, string> = { 1: "ONE_DAY", 3: "THREE_DAYS", 5: "FIVE_DAYS", 7: "ONE_WEEK", 14: "TWO_WEEKS", 30: "ONE_MONTH", 60: "TWO_MONTHS", 90: "THREE_MONTHS", 120: "FOUR_MONTHS", 150: "FIVE_MONTHS", 180: "SIX_MONTHS", 365: "ONE_YEAR", 400: "THIRTEEN_MONTHS", 545: "EIGHTEEN_MONTHS", 731: "TWO_YEARS", 1096: "THREE_YEARS", 1827: "FIVE_YEARS", 3653: "TEN_YEARS" };
    return `new logs.LogGroup(this, "${varName}", {
  logGroupName: "${resourceName}",
  retention: logs.RetentionDays.${NAMES[nearest] ?? "ONE_MONTH"},${s.logClass === "infrequent-access" ? "\n  logGroupClass: logs.LogGroupClass.INFREQUENT_ACCESS," : ""}${s.encryption === "customer-managed" ? "\n  // encryptionKey: pass a kms.Key here" : ""}
});`;
  },
  cfnTypes: ["AWS::Logs::LogGroup"],
  cfn: (s, { resourceName }) => [
    {
      Type: "AWS::Logs::LogGroup",
      Properties: {
        LogGroupName: resourceName,
        RetentionInDays: num(s.retentionDays, 30),
        ...(s.logClass === "infrequent-access" ? { LogGroupClass: "INFREQUENT_ACCESS" } : {}),
      },
      Metadata: {
        Overhead:
          s.encryption === "customer-managed"
            ? "KmsKeyId: point at your key."
            : "Retention is the whole cost story here · a group with none keeps everything forever.",
      },
    },
  ],
  fromCfn: (p) =>
    defined({
      retentionDays: typeof p.RetentionInDays === "number" ? p.RetentionInDays : undefined,
      logClass: p.LogGroupClass === "INFREQUENT_ACCESS" ? "infrequent-access" : p.LogGroupClass === "STANDARD" ? "standard" : undefined,
      encryption: p.KmsKeyId ? "customer-managed" : undefined,
    }),
  price: (s, _traffic, pricing) => {
    const ingest = num(s.ingestGbPerMonth, 5);
    const ia = s.logClass === "infrequent-access";
    const stored = num(s.storedGbPerMonth, (ingest * num(s.retentionDays, 30)) / 30);
    const scanned = num(s.insightsScannedGbPerMonth, 0);
    return [
      line(price(pricing, ia ? "logs.ingestIaGb" : "logs.ingestGb"), ingest),
      line(price(pricing, "logs.storageGbMonth"), stored),
      line(price(pricing, "logs.scannedGb"), scanned),
    ];
  },
});
