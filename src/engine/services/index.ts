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
};

export function getService(id: string): ServiceDef | undefined {
  return (SERVICES as Record<string, ServiceDef>)[id];
}
