import type { ServiceId } from "../model";
import type { ServiceDef } from "../defineService";
import { lambda } from "./lambda";
import { apigateway } from "./apigateway";
import { dynamodb } from "./dynamodb";
import { s3 } from "./s3";
import { cloudfront } from "./cloudfront";
import { sqs } from "./sqs";
import { sns } from "./sns";
import { eventbridge } from "./eventbridge";
import { stepfunctions } from "./stepfunctions";
import { cognito } from "./cognito";
import { kms } from "./kms";
import { secretsmanager } from "./secretsmanager";
import { ssmparameter } from "./ssmparameter";
import { cloudwatchlogs } from "./cloudwatchlogs";
import { kinesis } from "./kinesis";
import { firehose } from "./firehose";

export const SERVICES: Record<ServiceId, ServiceDef> = {
  lambda,
  apigateway,
  dynamodb,
  s3,
  cloudfront,
  sqs,
  sns,
  eventbridge,
  stepfunctions,
  cognito,
  kinesis,
  firehose,
  kms,
  secretsmanager,
  ssmparameter,
  cloudwatchlogs,
};

export function getService(id: string): ServiceDef | undefined {
  return (SERVICES as Record<string, ServiceDef>)[id];
}
