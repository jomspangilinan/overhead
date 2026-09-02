// Amazon Data Firehose (Kinesis Firehose as was) · one charge per GB
// ingested, and a second if it converts your records to Parquet on the way
// to S3. No shards, no capacity decision: this is the cheap path from a
// stream to a bucket, which is exactly why it belongs beside Kinesis on
// the diagram.

import { defineService } from "../defineService";
import { price } from "../pricing";
import { defined, line, num } from "./util";

const DESTINATIONS = ["s3", "opensearch", "redshift", "splunk", "http-endpoint"] as const;

export const firehose = defineService({
  id: "firehose",
  term: "Amazon Data Firehose",
  icon: "aws-firehose",
  role: "messaging",
  settings: {
    ingestGbPerMonth: {
      type: "number",
      min: 0,
      default: 50,
      label: "Ingested (GB / month)",
      driver: true,
    },
    destination: {
      type: "enum",
      values: DESTINATIONS,
      default: "s3",
      label: "Destination",
      description: "What it delivers to · the destination's own storage is priced on its node",
    },
    formatConversion: {
      type: "boolean",
      default: false,
      label: "Parquet / ORC conversion",
      driver: true,
    },
    transformLambda: {
      type: "boolean",
      default: false,
      label: "Lambda transform",
      description: "The transform function is priced on its own node",
    },
    encryption: {
      type: "enum",
      values: ["none", "kms"],
      default: "kms",
      label: "Server-side encryption",
      group: "security",
    },
  },
  cardLines: ["ingestGbPerMonth", "destination", "formatConversion"],
  badge: (s) => (s.encryption === "kms" ? "SSE-KMS" : "no SSE"),
  cdk: (s, { varName, resourceName }) =>
    `// Firehose has no stable L2 construct · this is the L1.
new firehose.CfnDeliveryStream(this, "${varName}", {
  deliveryStreamName: "${resourceName}",
  deliveryStreamType: "DirectPut",
  // destination on the canvas: ${String(s.destination ?? "s3")}${s.formatConversion === true ? " · with Parquet conversion" : ""}
  extendedS3DestinationConfiguration: {
    bucketArn: "arn:aws:s3:::replace-me",
    roleArn: "arn:aws:iam::123456789012:role/replace-me",
  },
});`,
  cfnTypes: ["AWS::KinesisFirehose::DeliveryStream"],
  cfn: (s, { resourceName }) => [
    {
      Type: "AWS::KinesisFirehose::DeliveryStream",
      Properties: {
        DeliveryStreamName: resourceName,
        DeliveryStreamType: "DirectPut",
        ExtendedS3DestinationConfiguration: {
          BucketARN: "arn:aws:s3:::replace-me",
          RoleARN: { "Fn::Sub": "arn:aws:iam::${AWS::AccountId}:role/replace-me" },
          ...(s.encryption === "kms"
            ? { EncryptionConfiguration: { KMSEncryptionConfig: { AWSKMSKeyARN: "alias/aws/s3" } } }
            : {}),
        },
      },
      Metadata: {
        Overhead:
          `Destination on the canvas is ${String(s.destination ?? "s3")} · the bucket ARN and delivery role are stubs.` +
          (s.formatConversion === true ? " Parquet conversion needs a Glue table: not generated." : "") +
          (s.transformLambda === true ? " The transform function is a separate resource." : ""),
      },
    },
  ],
  fromCfn: (p) => {
    const s3 = (p.ExtendedS3DestinationConfiguration ?? p.S3DestinationConfiguration) as
      | { EncryptionConfiguration?: unknown; DataFormatConversionConfiguration?: { Enabled?: boolean } }
      | undefined;
    return defined({
      destination: p.ExtendedS3DestinationConfiguration || p.S3DestinationConfiguration
        ? "s3"
        : p.RedshiftDestinationConfiguration
          ? "redshift"
          : p.SplunkDestinationConfiguration
            ? "splunk"
            : p.HttpEndpointDestinationConfiguration
              ? "http-endpoint"
              : p.AmazonopensearchserviceDestinationConfiguration
                ? "opensearch"
                : undefined,
      formatConversion: s3?.DataFormatConversionConfiguration
        ? s3.DataFormatConversionConfiguration.Enabled !== false
        : undefined,
      encryption: s3?.EncryptionConfiguration ? "kms" : undefined,
    });
  },
  price: (s, _traffic, pricing) => {
    const gb = num(s.ingestGbPerMonth, 50);
    const lines = [line(price(pricing, "firehose.ingestGb"), gb)];
    if (s.formatConversion === true) {
      lines.push(line(price(pricing, "firehose.formatConversionGb"), gb));
    }
    return lines;
  },
});
