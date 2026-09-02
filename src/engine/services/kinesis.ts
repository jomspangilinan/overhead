// Kinesis Data Streams · the one place on a serverless diagram where a
// capacity decision is worth real money. On-demand bills a stream hour plus
// every GB in and every GB out per consumer; provisioned bills shard hours
// whether or not anything is flowing. The crossover is what the Inspector
// is for.

import { defineService } from "../defineService";
import { price } from "../pricing";
import { HOURS_PER_MONTH, defined, line, num } from "./util";

export const kinesis = defineService({
  id: "kinesis",
  term: "Amazon Kinesis Data Streams",
  icon: "aws-kinesis",
  role: "messaging",
  settings: {
    capacityMode: {
      type: "enum",
      values: ["on-demand", "provisioned"],
      default: "on-demand",
      label: "Capacity mode",
      driver: true,
    },
    shards: {
      type: "number",
      min: 1,
      default: 2,
      label: "Shards",
      driver: true,
      description: "Provisioned only · each shard takes 1 MB/s in and 2 MB/s out",
    },
    ingestGbPerMonth: {
      type: "number",
      min: 0,
      default: 50,
      label: "Ingested (GB / month)",
      driver: true,
    },
    consumers: {
      type: "number",
      min: 0,
      default: 1,
      label: "Consumers",
      driver: true,
      description: "On-demand bills the data each consumer reads",
    },
    putRecordsPerMonth: {
      type: "number",
      min: 0,
      optional: true,
      label: "Records put / month",
      driver: true,
      description: "Provisioned only · billed in 25 KB payload units. Defaults to the canvas traffic figure",
    },
    retentionHours: {
      type: "number",
      min: 24,
      default: 24,
      label: "Retention (hours)",
      description: "Past 24 hours is billed extra per GB-month",
    },
    encryption: {
      type: "enum",
      values: ["none", "kms"],
      default: "kms",
      label: "Encryption at rest",
      group: "security",
    },
  },
  cardLines: ["capacityMode", "ingestGbPerMonth", "consumers"],
  badge: (s) => (s.encryption === "kms" ? "SSE-KMS" : "no SSE"),
  cdk: (s, { varName, resourceName }) =>
    `new kinesis.Stream(this, "${varName}", {
  streamName: "${resourceName}",
  streamMode: kinesis.StreamMode.${s.capacityMode === "provisioned" ? "PROVISIONED" : "ON_DEMAND"},${s.capacityMode === "provisioned" ? `\n  shardCount: ${num(s.shards, 2)},` : ""}
  retentionPeriod: cdk.Duration.hours(${num(s.retentionHours, 24)}),
  encryption: kinesis.StreamEncryption.${s.encryption === "kms" ? "KMS" : "UNENCRYPTED"},
});`,
  cfnTypes: ["AWS::Kinesis::Stream"],
  cfn: (s, { resourceName }) => {
    const provisioned = s.capacityMode === "provisioned";
    return [
      {
        Type: "AWS::Kinesis::Stream",
        Properties: {
          Name: resourceName,
          StreamModeDetails: { StreamMode: provisioned ? "PROVISIONED" : "ON_DEMAND" },
          ...(provisioned ? { ShardCount: num(s.shards, 2) } : {}),
          RetentionPeriodHours: num(s.retentionHours, 24),
          ...(s.encryption === "kms"
            ? { StreamEncryption: { EncryptionType: "KMS", KeyId: "alias/aws/kinesis" } }
            : {}),
        },
      },
    ];
  },
  fromCfn: (p) => {
    const mode = (p.StreamModeDetails as { StreamMode?: string } | undefined)?.StreamMode;
    return defined({
      capacityMode: mode === "PROVISIONED" ? "provisioned" : mode === "ON_DEMAND" ? "on-demand" : undefined,
      shards: typeof p.ShardCount === "number" ? p.ShardCount : undefined,
      retentionHours: typeof p.RetentionPeriodHours === "number" ? p.RetentionPeriodHours : undefined,
      encryption: p.StreamEncryption ? "kms" : undefined,
    });
  },
  price: (s, traffic, pricing) => {
    const ingest = num(s.ingestGbPerMonth, 50);
    if (s.capacityMode === "provisioned") {
      return [
        line(price(pricing, "kinesis.shardHour"), num(s.shards, 2) * HOURS_PER_MONTH),
        // 25 KB payload units, rounded up per record · one unit per record
        // is the honest floor for records under 25 KB.
        line(price(pricing, "kinesis.putPayloadUnits"), num(s.putRecordsPerMonth, traffic.requestsPerMonth)),
      ];
    }
    return [
      line(price(pricing, "kinesis.onDemandStreamHour"), HOURS_PER_MONTH),
      line(price(pricing, "kinesis.onDemandIngestGb"), ingest),
      line(price(pricing, "kinesis.onDemandEgressGb"), ingest * num(s.consumers, 1)),
    ];
  },
});
