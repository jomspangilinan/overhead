// CloudFormation import: a template in, a drawing out.
//
// Two paths, and which one runs is decided by the template itself.
//
//   Own template  — a `Metadata.Overhead` block written by the exporter.
//                   Positions, containers, sections, traffic and every
//                   setting come back exactly as they left. Round-trip.
//   Foreign one   — `cdk synth --json`, the console, someone else's repo.
//                   Resources are matched to services by their CloudFormation
//                   type, settings are read back through defineService().
//                   fromCfn(), containment comes from VPCs and subnets, and
//                   the edges are inferred from what references what.
//
// Both YAML and JSON are read · YAML is what people write and what the
// exporter emits, and its short-form intrinsics (!Ref, !GetAtt) are
// resolved by iac/yaml.ts into the long forms the rest of this file reads.

import type { ArchEdge, ArchNode, ServiceId, StateSnapshot } from "../model";
import { DEFAULT_TRAFFIC } from "../model";
import type { Container, ContainerKind } from "../containers";
import { migrateSnapshot } from "../migrate";
import { parseYaml } from "./yaml";
import { defaultSettings } from "../defineService";
import { getService, SERVICES } from "../services";
import { OVERHEAD_METADATA_KEY } from "../exporters/cloudformation";

export interface CfnTemplate {
  Resources?: Record<string, { Type?: string; Properties?: Record<string, unknown>; Metadata?: Record<string, unknown> }>;
  Metadata?: Record<string, unknown>;
  Description?: string;
}

export interface ImportReport {
  /** Did this template come out of Overhead, with its metadata intact? */
  source: "overhead" | "foreign";
  nodes: number;
  edges: number;
  containers: number;
  /** Resource types that are not modelled here, with how many there were. */
  skipped: { type: string; count: number }[];
  notes: string[];
}

export type ImportResult =
  | {
      ok: true;
      snapshot: StateSnapshot;
      report: ImportReport;
      /** Per node, the settings the template actually stated. A merge
       *  applies only these · everything else (traffic, durations, storage)
       *  has no CloudFormation home and must not be reset to a default. */
      stated: Record<string, string[]>;
    }
  | { ok: false; code: "invalid_json" | "not_a_template"; message: string };

/** Every CloudFormation type the ten services answer to. */
export function serviceByCfnType(): Map<string, ServiceId> {
  const map = new Map<string, ServiceId>();
  for (const def of Object.values(SERVICES)) {
    for (const type of def.cfnTypes ?? []) map.set(type, def.id);
  }
  return map;
}

export function parseTemplate(raw: string): CfnTemplate | { error: ImportResult } {
  const text = raw.trim();
  if (!text) return { error: { ok: false, code: "invalid_json", message: "The template is empty." } };
  let parsed: unknown;
  try {
    parsed = text.startsWith("{") ? JSON.parse(text) : parseYaml(text);
  } catch (err) {
    return {
      error: {
        ok: false,
        code: "invalid_json",
        message: `That is not a readable template: ${err instanceof Error ? err.message : String(err)}`,
      },
    };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { error: { ok: false, code: "not_a_template", message: "A template is a JSON object." } };
  }
  const t = parsed as CfnTemplate;
  if (!t.Resources || typeof t.Resources !== "object") {
    return { error: { ok: false, code: "not_a_template", message: "No Resources section · this is not a CloudFormation template." } };
  }
  return t;
}

export function importCloudFormation(raw: string, opts: { region?: string } = {}): ImportResult {
  const parsed = parseTemplate(raw);
  if ("error" in parsed) return parsed.error;
  const template = parsed;

  const own = (template.Metadata?.[OVERHEAD_METADATA_KEY] ?? null) as OverheadBlock | null;
  if (own && Array.isArray(own.nodes)) return fromOwnTemplate(own);
  return fromForeignTemplate(template, opts.region ?? "ap-southeast-1");
}

// ── Our own template ──────────────────────────────────────────────────────

interface OverheadBlock {
  version?: number;
  drawing?: string;
  region?: string;
  traffic?: unknown;
  containers?: unknown[];
  sections?: unknown[];
  nodes?: { id?: string; service?: string; name?: string; container?: string; position?: unknown; settings?: unknown; card?: unknown }[];
  edges?: unknown[];
}

function fromOwnTemplate(block: OverheadBlock): ImportResult {
  const nodes = (block.nodes ?? []).filter((n) => n.service && getService(String(n.service)));
  const dropped = (block.nodes ?? []).length - nodes.length;
  const snapshot = migrateSnapshot({
    nodes: nodes as never,
    edges: (block.edges ?? []) as never,
    containers: (block.containers ?? []) as never,
    sections: (block.sections ?? []) as never,
    traffic: (block.traffic ?? DEFAULT_TRAFFIC) as never,
  });
  return {
    ok: true,
    snapshot,
    // Our own template states everything, settings included.
    stated: Object.fromEntries(snapshot.nodes.map((n) => [n.id, Object.keys(n.settings)])),
    report: {
      source: "overhead",
      nodes: snapshot.nodes.length,
      edges: snapshot.edges.length,
      containers: snapshot.containers.length,
      skipped: [],
      notes: [
        `Written by Overhead${block.drawing ? ` from "${block.drawing}"` : ""} · positions, containers, sections and settings came back exactly.`,
        ...(dropped ? [`${dropped} resource(s) named a service this build does not have.`] : []),
      ],
    },
  };
}

// ── Somebody else's template ──────────────────────────────────────────────

/** Where a resource's human name usually lives, in the order we try. */
const NAME_KEYS = [
  "FunctionName",
  "QueueName",
  "TopicName",
  "TableName",
  "UserPoolName",
  "StateMachineName",
  "BucketName",
  "Name",
];

function nameOf(logicalId: string, props: Record<string, unknown>): string {
  for (const key of NAME_KEYS) {
    const v = props[key];
    if (typeof v === "string" && v.trim()) return v;
  }
  const comment = (props.DistributionConfig as { Comment?: unknown } | undefined)?.Comment;
  if (typeof comment === "string" && comment.trim()) return comment;
  // CamelCase logical id → "Orders Api"
  return logicalId.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
}

/** Every logical id this value points at, through Ref / GetAtt / Sub. */
export function referencedIds(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const v of value) referencedIds(v, out);
    return out;
  }
  if (!value || typeof value !== "object") return out;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (k === "Ref" && typeof v === "string") out.add(v);
    else if (k === "Fn::GetAtt") {
      if (Array.isArray(v) && typeof v[0] === "string") out.add(v[0]);
      else if (typeof v === "string") out.add(v.split(".")[0]);
    } else if (k === "Fn::Sub") {
      const body = Array.isArray(v) ? v[0] : v;
      if (typeof body === "string") {
        for (const m of body.matchAll(/\$\{([A-Za-z0-9]+)(?:\.[A-Za-z0-9.]+)?\}/g)) out.add(m[1]);
      }
      if (Array.isArray(v)) referencedIds(v[1], out);
    } else referencedIds(v, out);
  }
  return out;
}

/** Resources that are not nodes but say how two nodes are connected. */
const CONNECTORS: Record<string, { from: string[]; to: string[]; kind: ArchEdge["kind"] }> = {
  "AWS::Lambda::EventSourceMapping": { from: ["EventSourceArn"], to: ["FunctionName"], kind: "async" },
  "AWS::SNS::Subscription": { from: ["TopicArn"], to: ["Endpoint"], kind: "async" },
  "AWS::Events::Rule": { from: ["EventBusName"], to: ["Targets"], kind: "async" },
  "AWS::ApiGatewayV2::Integration": { from: ["ApiId"], to: ["IntegrationUri"], kind: "sync" },
  "AWS::ApiGateway::Method": { from: ["RestApiId"], to: ["Integration"], kind: "sync" },
  "AWS::Lambda::Permission": { from: ["SourceArn"], to: ["FunctionName"], kind: "sync" },
};

const DATA_TARGETS: ServiceId[] = ["s3", "dynamodb"];
const ASYNC_TARGETS: ServiceId[] = ["sqs", "sns", "eventbridge"];

function kindFor(target: ServiceId): ArchEdge["kind"] {
  if (DATA_TARGETS.includes(target)) return "data";
  if (ASYNC_TARGETS.includes(target)) return "async";
  return "sync";
}

function fromForeignTemplate(template: CfnTemplate, region: string): ImportResult {
  const resources = template.Resources ?? {};
  const byType = serviceByCfnType();

  const nodes: ArchNode[] = [];
  const nodeByLogicalId = new Map<string, ArchNode>();
  const skipped = new Map<string, number>();
  const stated: Record<string, string[]> = {};

  // 1 · resources that are services
  for (const [logicalId, res] of Object.entries(resources)) {
    const type = String(res?.Type ?? "");
    const serviceId = byType.get(type);
    const props = (res?.Properties ?? {}) as Record<string, unknown>;
    if (!serviceId) continue;
    const def = getService(serviceId)!;
    const read = def.fromCfn?.(props, type) ?? {};
    const node: ArchNode = {
      id: `${serviceId}-${logicalId}`,
      service: serviceId,
      name: nameOf(logicalId, props),
      settings: { ...defaultSettings(def), ...read },
      position: { x: 0, y: 0 },
    };
    stated[node.id] = Object.keys(read);
    nodes.push(node);
    nodeByLogicalId.set(logicalId, node);
  }

  // 2 · VPCs and subnets are the containment the template does state
  const containers: Container[] = [];
  const containerByLogicalId = new Map<string, Container>();
  const cloud: Container = { id: "container-cloud", kind: "cloud", name: "AWS Cloud", collapsed: false };
  const regionBox: Container = { id: "container-region", kind: "region", name: region, parent: cloud.id, collapsed: false };
  containers.push(cloud, regionBox);

  for (const [logicalId, res] of Object.entries(resources)) {
    if (res?.Type !== "AWS::EC2::VPC") continue;
    const props = (res.Properties ?? {}) as Record<string, unknown>;
    const box: Container = {
      id: `container-${logicalId}`,
      kind: "vpc",
      name: tagName(props) ?? logicalId,
      cidr: typeof props.CidrBlock === "string" ? props.CidrBlock : undefined,
      parent: regionBox.id,
      collapsed: false,
    };
    containers.push(box);
    containerByLogicalId.set(logicalId, box);
  }
  for (const [logicalId, res] of Object.entries(resources)) {
    if (res?.Type !== "AWS::EC2::Subnet") continue;
    const props = (res.Properties ?? {}) as Record<string, unknown>;
    const parentVpc = [...referencedIds(props.VpcId)].map((id) => containerByLogicalId.get(id)).find(Boolean);
    const kind: ContainerKind = props.MapPublicIpOnLaunch === true ? "subnetpub" : "subnetpri";
    const box: Container = {
      id: `container-${logicalId}`,
      kind,
      name: tagName(props) ?? logicalId,
      cidr: typeof props.CidrBlock === "string" ? props.CidrBlock : undefined,
      parent: parentVpc?.id ?? regionBox.id,
      collapsed: false,
    };
    containers.push(box);
    containerByLogicalId.set(logicalId, box);
  }

  // A function with a VpcConfig names the subnet it runs in; everything
  // else sits in the region.
  for (const [logicalId, res] of Object.entries(resources)) {
    const node = nodeByLogicalId.get(logicalId);
    if (!node) continue;
    const vpcConfig = (res?.Properties as { VpcConfig?: { SubnetIds?: unknown } } | undefined)?.VpcConfig;
    const subnet = vpcConfig
      ? [...referencedIds(vpcConfig.SubnetIds)].map((id) => containerByLogicalId.get(id)).find(Boolean)
      : undefined;
    node.container = subnet?.id ?? regionBox.id;
  }

  // 3 · edges. Connector resources first (they carry the real semantics),
  // then any leftover reference between two services.
  const edges: ArchEdge[] = [];
  const seen = new Set<string>();
  const push = (fromId: string, toId: string, kind: ArchEdge["kind"]) => {
    if (fromId === toId) return;
    const key = `${fromId}->${toId}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ id: `edge-${edges.length + 1}`, from: fromId, to: toId, kind });
  };

  for (const [logicalId, res] of Object.entries(resources)) {
    const type = String(res?.Type ?? "");
    const connector = CONNECTORS[type];
    const props = (res?.Properties ?? {}) as Record<string, unknown>;
    if (!connector) {
      if (!nodeByLogicalId.has(logicalId) && !containerByLogicalId.has(logicalId)) {
        skipped.set(type || "(untyped)", (skipped.get(type || "(untyped)") ?? 0) + 1);
      }
      continue;
    }
    const sources = connector.from.flatMap((k) => [...referencedIds(props[k])]);
    const targets = connector.to.flatMap((k) => [...referencedIds(props[k])]);
    for (const s of sources) {
      for (const t of targets) {
        const a = nodeByLogicalId.get(s);
        const b = nodeByLogicalId.get(t);
        if (a && b) push(a.id, b.id, connector.kind);
      }
    }
  }

  for (const [logicalId, res] of Object.entries(resources)) {
    const from = nodeByLogicalId.get(logicalId);
    if (!from) continue;
    for (const ref of referencedIds(res?.Properties)) {
      const to = nodeByLogicalId.get(ref);
      if (to) push(from.id, to.id, kindFor(to.service));
    }
  }

  // A container nobody landed in says nothing · keep only the boxes that
  // hold a resource, and the ancestors that hold those.
  const byId = new Map(containers.map((c) => [c.id, c]));
  const keep = new Set<string>();
  for (const node of nodes) {
    let cursor = node.container;
    while (cursor && !keep.has(cursor)) {
      keep.add(cursor);
      cursor = byId.get(cursor)?.parent;
    }
  }
  const kept = containers.filter((c) => keep.has(c.id));

  const snapshot: StateSnapshot = {
    nodes,
    edges,
    containers: kept,
    sections: [],
    traffic: { ...DEFAULT_TRAFFIC },
  };

  const skippedList = [...skipped.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  return {
    ok: true,
    snapshot,
    stated,
    report: {
      source: "foreign",
      nodes: nodes.length,
      edges: edges.length,
      containers: kept.length,
      skipped: skippedList,
      notes: [
        "Settings came from the template; everything it does not state (traffic, durations, storage) is at its default · tune them until the estimate matches your bill.",
        ...(edges.length ? [] : ["No connections were inferable · the template states no references between these resources."]),
        ...(skippedList.length
          ? [`${skippedList.reduce((n, s) => n + s.count, 0)} resource(s) of ${skippedList.length} type(s) are not modelled here and were left out.`]
          : []),
      ],
    },
  };
}

function tagName(props: Record<string, unknown>): string | undefined {
  const tags = props.Tags;
  if (!Array.isArray(tags)) return undefined;
  for (const t of tags) {
    if (t && typeof t === "object" && (t as { Key?: string }).Key === "Name") {
      const v = (t as { Value?: unknown }).Value;
      if (typeof v === "string" && v.trim()) return v;
    }
  }
  return undefined;
}
