import type { Finding, StateSnapshot } from "../model";
import type { PricingTable } from "../pricing";
import { restWhereHttpWouldDo } from "./rest_where_http_would_do";
import { standardWorkflowHighVolume } from "./standard_workflow_high_volume";
import { x86Lambda } from "./x86_lambda";
import { memoryDurationTradeoff } from "./memory_duration_tradeoff";
import { onDemandSteadyState } from "./on_demand_steady_state";
import { noLifecycleOnLogs } from "./no_lifecycle_on_logs";
import { s3PublicNoCdn } from "./s3_public_no_cdn";
import { asyncNoDlq } from "./async_no_dlq";
import { unboundedFanout } from "./unbounded_fanout";

export type Rule = (snapshot: StateSnapshot, pricing: PricingTable) => Finding[];

export const RULES: Rule[] = [
  restWhereHttpWouldDo,
  standardWorkflowHighVolume,
  x86Lambda,
  memoryDurationTradeoff,
  onDemandSteadyState,
  noLifecycleOnLogs,
  s3PublicNoCdn,
  asyncNoDlq,
  unboundedFanout,
];
