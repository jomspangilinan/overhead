// Core data model. Pure TS — no React, no DOM.

import type { Container } from "./containers";

export type { Container, ContainerKind } from "./containers";

export type EdgeKind = "sync" | "async" | "data";

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
  | "cognito";

export interface ArchNode {
  id: string;
  service: ServiceId;
  name: string;
  settings: Record<string, unknown>;
  /** Exactly one container — structural, validated. */
  container?: string;
  position: { x: number; y: number };
}

export interface ArchEdge {
  id: string;
  from: string;
  to: string;
  kind: EdgeKind;
  volumePerMonth?: number;
  label?: string;
}

/** Yours: free-form, orthogonal to containment, never validated.
 *  nodeIds is the single source of truth for membership. */
export interface Section {
  id: string;
  name: string;
  color: string;
  bounds?: { x: number; y: number; w: number; h: number };
  nodeIds: string[];
  collapsed: boolean;
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
