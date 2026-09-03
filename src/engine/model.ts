// Core data model. Pure TS — no React, no DOM.

import type { Container } from "./containers";

export type { Container, ContainerKind } from "./containers";

export type EdgeKind = "sync" | "async" | "data";
/** The three, as a list · what a patch or a tool validates against. */
export const EDGE_KINDS: readonly EdgeKind[] = ["sync", "async", "data"];

/** Internal layout role — not a model concept and never shown in the UI.
 *  autoLayout() uses it to arrange left to right and emits sections. */
export type Role =
  | "ingress"
  | "handlers"
  | "messaging"
  | "workers"
  | "data";

export type ServiceId =
  | "lambda"
  | "apigateway"
  | "dynamodb"
  | "s3"
  | "cloudfront"
  | "sqs"
  | "sns"
  | "eventbridge"
  | "stepfunctions"
  | "cognito"
  | "kinesis"
  | "firehose"
  | "kms"
  | "secretsmanager"
  | "ssmparameter"
  | "cloudwatchlogs";

export interface ArchNode {
  id: string;
  service: ServiceId;
  name: string;
  settings: Record<string, unknown>;
  /** Exactly one container — structural, validated. */
  container?: string;
  position: { x: number; y: number };
  /** What this node's card shows (the gear). Absent = the service's
   *  cardLines and the global card options. Presentation only. */
  card?: { lines?: string[]; cost?: boolean; badge?: boolean };
}

/** Global card and cost presentation (the Cards and Cost gears). */
export interface CardShow {
  settings: boolean;
  cost: boolean;
  badge: boolean;
}
export interface CostDisplay {
  nodes: boolean;
  containers: boolean;
  period: "month" | "year";
  decimals: 0 | 2;
}
export const DEFAULT_CARD_SHOW: CardShow = { settings: true, cost: true, badge: true };
export const DEFAULT_COST_DISPLAY: CostDisplay = { nodes: true, containers: true, period: "month", decimals: 2 };

/** Money as the Cost gear wants it: per month or per year, 0 or 2 decimals. */
export function formatCost(monthly: number, d: CostDisplay = DEFAULT_COST_DISPLAY): string {
  const v = toMoney(d.period === "year" ? monthly * 12 : monthly);
  return `$${v.toFixed(d.decimals)}${d.period === "year" ? "/yr" : ""}`;
}

export type EdgeDash = "solid" | "dashed" | "dotted";
export type ArrowMode = "none" | "end" | "start" | "both";
export type EdgeShape = "curve" | "straight" | "step";
/** Which side of a node an edge leaves or enters; `auto` picks by geometry. */
export type Side = "auto" | "left" | "right" | "top" | "bottom";

/** Per-edge appearance — purely visual, and separate from `kind`. The kind
 *  decides the default look (solid / dashed / dotted, arrow unless data);
 *  these pin what a user changed by hand. Absent = follow the kind.
 *  Nothing here is ever read for semantics: findings, layers, exports and
 *  the agent's tools look at `kind` only. */
export interface EdgeStyle {
  /** Stroke width in px; absent = follow volumePerMonth. */
  width?: number;
  dash?: EdgeDash;
  arrow?: ArrowMode;
  /** Curve (default), straight polyline, or axis-aligned steps. */
  shape?: EdgeShape;
}

export interface ArchEdge {
  id: string;
  from: string;
  to: string;
  /** Semantic: what the connection is. sync = request/response,
   *  async = queue/event, data = storage flow. */
  kind: EdgeKind;
  volumePerMonth?: number;
  label?: string;
  style?: EdgeStyle;
  /** Bend points the path passes through, in order, stored once the user
   *  drags them; absent = the floating default routing. */
  waypoints?: { x: number; y: number }[];
  /** Pinned exit / entry sides; absent or `auto` = picked by geometry. */
  anchors?: { from?: Side; to?: Side };
}

/** The kind's default dash — the semantic encoding. */
export function dashForKind(kind: EdgeKind): EdgeDash {
  return kind === "async" ? "dashed" : kind === "data" ? "dotted" : "solid";
}
/** What the edge is drawn with: the pinned style, else the kind's default. */
export function dashOf(e: Pick<ArchEdge, "kind" | "style">): EdgeDash {
  return e.style?.dash ?? dashForKind(e.kind);
}
export function arrowModeOf(e: Pick<ArchEdge, "kind" | "style">): ArrowMode {
  return e.style?.arrow ?? (e.kind === "data" ? "none" : "end");
}

/** Yours: free-form, orthogonal to containment, never validated.
 *  nodeIds is the single source of truth for membership.
 *  kind `section` draws a labelled frame on the canvas; kind `group`
 *  (⌘G) is a folder in the Layers tree that moves together and draws
 *  nothing. Both nest under a parent section via `parentId` (tree only). */
export interface Section {
  id: string;
  name: string;
  color: string;
  kind?: "section" | "group";
  parentId?: string;
  bounds?: { x: number; y: number; w: number; h: number };
  nodeIds: string[];
  collapsed: boolean;
  style?: SectionStyle;
}

/** Section appearance — absent = dashed 1.4px with a faint fill. */
export interface SectionStyle {
  dash?: EdgeDash;
  width?: number;
  fill?: boolean;
}

export interface Traffic {
  requestsPerMonth: number;
  avgPayloadKb: number;
}

export interface StateSnapshot {
  nodes: ArchNode[];
  edges: ArchEdge[];
  containers: Container[];
  sections: Section[];
  traffic: Traffic;
}

export interface Scenario {
  id: string;
  name: string;
  base: StateSnapshot;
  fork: StateSnapshot;
}

export type Severity = "info" | "warn" | "critical";

// Derived, never stored.
export interface Finding {
  rule: string;
  severity: Severity;
  message: string;
  docUrl: string;
  nodeIds: string[];
  estimatedSaving?: number;
}

export interface CostLine {
  sku: string;
  unit: string;
  qty: number;
  rate: number;
  monthly: number;
  sourceUrl: string;
}

// Derived, never stored.
export interface NodeCost {
  nodeId: string;
  lines: CostLine[];
  monthly: number;
}

export const DEFAULT_TRAFFIC: Traffic = {
  requestsPerMonth: 1_000_000,
  avgPayloadKb: 32,
};

export function emptySnapshot(): StateSnapshot {
  return {
    nodes: [],
    edges: [],
    containers: [],
    sections: [],
    traffic: { ...DEFAULT_TRAFFIC },
  };
}

/** Round to cents for display-stable golden tests. */
export function toMoney(n: number): number {
  return Math.round(n * 100) / 100;
}
