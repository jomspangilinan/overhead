// The core tool surface (reads + writes). Every mutation goes through the
// zustand store synchronously, so the agent's next read sees reality.
// Read tools carry readOnlyHint; outputs stay under ~1.5K chars.

import {
  useStore,
  snapshotOf,
  pricingOf,
  PRICING_TABLES,
  type Layer,
} from "@/store/useStore";
import { SERVICES, getService } from "@/engine/services";
import { validateSetting, defaultSettings } from "@/engine/defineService";
import { allCosts, monthlyTotal, nodeCost } from "@/engine/cost";
import { allFindings } from "@/engine/findings";
import { toMoney, type EdgeKind } from "@/engine/model";
import { laneOf } from "@/engine/layout";
import { errorResult, text, type ToolSpec } from "./toolRegistry";

const money = (n: number) => toMoney(n);

function nodeOr(id: unknown) {
  const s = useStore.getState();
  const node = s.nodes.find((n) => n.id === id);
  return node ?? null;
}

function noNode(id: unknown) {
  const ids = useStore.getState().nodes.map((n) => n.id);
  return errorResult("no_such_node", `No node "${String(id)}".`, { ids });
}

export const PATTERNS = [
  "arm64",
  "http_api",
  "express_workflows",
  "provisioned_capacity",
  "cdn_in_front",
  "dlq_everywhere",
] as const;

export function coreTools(): ToolSpec[] {
  return [
    // ---------- reads ----------
    {
      name: "get_architecture",
      description:
        "Current canvas: nodes (id, service, name, monthly cost), edges, traffic and the monthly total. Use get_node for full settings.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      readOnly: true,
      execute: () => {
        const s = useStore.getState();
        const snap = snapshotOf(s);
        const pricing = pricingOf(s);
        const costs = new Map(allCosts(snap, pricing).map((c) => [c.nodeId, c.monthly]));
        return text({
          nodes: s.nodes.map((n) => ({
            id: n.id,
            service: n.service,
            name: n.name,
            lane: laneOf(n),
            monthly: money(costs.get(n.id) ?? 0),
          })),
          edges: s.edges.map((e) => `${e.from}-${e.kind}->${e.to}`),
          traffic: s.traffic,
          region: s.region,
          monthlyTotal: money(monthlyTotal(snap, pricing)),
        });
      },
    },
    {
      name: "get_node",
      description:
        "Full detail for one node: settings in AWS console terms, cost lines with SKU provenance URLs.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string", description: "Node id" } },
        required: ["id"],
        additionalProperties: false,
      },
      readOnly: true,
      execute: ({ id }) => {
        const node = nodeOr(id);
        if (!node) return noNode(id);
        const s = useStore.getState();
        const cost = nodeCost(snapshotOf(s), node.id, pricingOf(s));
        return text({
          id: node.id,
          service: node.service,
          name: node.name,
          settings: node.settings,
          monthly: money(cost.monthly),
          lines: cost.lines.map((l) => ({
            unit: l.unit,
            qty: l.qty,
            rate: l.rate,
            monthly: money(l.monthly),
          })),
          pricingSource: cost.lines[0]?.sourceUrl,
        });
      },
    },
    {
      name: "get_cost_breakdown",
      description:
        "Monthly cost sorted high to low, grouped by node or service. The place to find what dominates the bill.",
      inputSchema: {
        type: "object",
        properties: {
          groupBy: { type: "string", enum: ["node", "service"], description: "Default: node" },
        },
        additionalProperties: false,
      },
      readOnly: true,
      execute: ({ groupBy }) => {
        const s = useStore.getState();
        const snap = snapshotOf(s);
        const pricing = pricingOf(s);
        const costs = allCosts(snap, pricing);
        if (groupBy === "service") {
          const byService = new Map<string, number>();
          for (const c of costs) {
            const node = s.nodes.find((n) => n.id === c.nodeId);
            if (!node) continue;
            byService.set(node.service, (byService.get(node.service) ?? 0) + c.monthly);
          }
          return text({
            groupBy: "service",
            rows: [...byService.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([service, monthly]) => ({ service, monthly: money(monthly) })),
            monthlyTotal: money(monthlyTotal(snap, pricing)),
          });
        }
        return text({
          groupBy: "node",
          rows: costs
            .sort((a, b) => b.monthly - a.monthly)
            .map((c) => ({
              id: c.nodeId,
              name: s.nodes.find((n) => n.id === c.nodeId)?.name,
              monthly: money(c.monthly),
            })),
          monthlyTotal: money(monthlyTotal(snap, pricing)),
        });
      },
    },
    {
      name: "list_services",
      description:
        "The ten supported AWS services with their setting names and price drivers. Call before add_service or set_property.",
      inputSchema: {
        type: "object",
        properties: {
          service: {
            type: "string",
            description: "Optional: one service id for its full settings schema",
          },
        },
        additionalProperties: false,
      },
      readOnly: true,
      execute: ({ service }) => {
        if (service !== undefined) {
          const def = getService(String(service));
          if (!def)
            return errorResult("no_such_service", `Unknown service "${String(service)}".`, {
              services: Object.keys(SERVICES),
            });
          return text({
            id: def.id,
            term: def.term,
            lane: def.lane,
            settings: Object.fromEntries(
              Object.entries(def.settings).map(([k, v]) => [
                k,
                {
                  type: v.type,
                  ...(v.type === "enum" ? { values: v.values } : {}),
                  ...(v.type === "number" ? { min: v.min, max: v.max } : {}),
                  ...("default" in v ? { default: v.default } : {}),
                  ...(v.driver ? { priceDriver: true } : {}),
                },
              ]),
            ),
          });
        }
        return text({
          services: Object.values(SERVICES).map((def) => ({
            id: def.id,
            term: def.term,
            drivers: Object.entries(def.settings)
              .filter(([, v]) => v.driver)
              .map(([k]) => k),
          })),
        });
      },
    },
    {
      name: "get_findings",
      description:
        "Rule findings on the current design: severity, message, AWS doc link, affected nodes, estimated monthly saving. The agent should act on these.",
      inputSchema: {
        type: "object",
        properties: {
          severity: {
            type: "string",
            enum: ["info", "warn", "critical"],
            description: "Optional: only this severity",
          },
        },
        additionalProperties: false,
      },
      readOnly: true,
      execute: ({ severity }) => {
        const s = useStore.getState();
        let findings = allFindings(snapshotOf(s), pricingOf(s));
        if (severity) findings = findings.filter((f) => f.severity === severity);
        return text({
          count: findings.length,
          findings: findings.slice(0, 5).map((f) => ({
            rule: f.rule,
            severity: f.severity,
            message: f.message,
            docUrl: f.docUrl,
            nodeIds: f.nodeIds,
            ...(f.estimatedSaving ? { estimatedSaving: f.estimatedSaving } : {}),
          })),
          ...(findings.length > 5 ? { note: "showing first 5; filter by severity" } : {}),
        });
      },
    },
    {
      name: "get_pricing_source",
      description:
        "Where every rate comes from: region, fetch date, and the AWS Price List file URLs in use.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      readOnly: true,
      execute: () => {
        const pricing = pricingOf(useStore.getState());
        const urls = [...new Set(Object.values(pricing.entries).map((e) => e.sourceUrl))];
        return text({
          region: pricing.region,
          generatedAt: pricing.generatedAt,
          index: pricing.source,
          files: urls.map((u) => u.split("/offers/")[1] ?? u).slice(0, 12),
          regions: Object.keys(PRICING_TABLES),
        });
      },
    },

    // ---------- writes ----------
    {
      name: "add_service",
      description:
        "Add a node to the canvas. Lands in its lane via auto-layout; returns its id and monthly cost. Settings use list_services vocabulary.",
      inputSchema: {
        type: "object",
        properties: {
          type: { type: "string", enum: Object.keys(SERVICES), description: "Service id" },
          name: { type: "string", description: "Resource name shown on the diagram" },
          settings: { type: "object", description: "Initial settings (console terms)" },
          group: { type: "string", description: "Optional group id to place the node in" },
        },
        required: ["type", "name"],
        additionalProperties: false,
      },
      execute: ({ type, name, settings, group }) => {
        if (group !== undefined && !useStore.getState().groups.some((g) => g.id === group))
          return errorResult("no_such_group", `No group "${String(group)}".`, {
            groups: useStore.getState().groups.map((g) => g.id),
          });
        const def = getService(String(type));
        if (!def)
          return errorResult("no_such_service", `Unknown service "${String(type)}".`, {
            services: Object.keys(SERVICES),
          });
        const clean: Record<string, unknown> = {};
        if (settings && typeof settings === "object") {
          for (const [k, v] of Object.entries(settings as Record<string, unknown>)) {
            const err = validateSetting(def, k, v);
            if (err) return errorResult(err.code, `${k}: ${err.message}`, err);
            clean[k] = v;
          }
        }
        const id = useStore
          .getState()
          .addNode(def.id, String(name), clean, group ? String(group) : undefined);
        const s = useStore.getState();
        const cost = nodeCost(snapshotOf(s), id, pricingOf(s));
        return text({
          id,
          monthly: money(cost.monthly),
          monthlyTotal: money(monthlyTotal(snapshotOf(s), pricingOf(s))),
        });
      },
    },
    {
      name: "connect",
      description:
        "Draw a typed edge. sync = request/response, async = queue/event, data = storage flow. Volume drives the line weight.",
      inputSchema: {
        type: "object",
        properties: {
          from: { type: "string" },
          to: { type: "string" },
          kind: { type: "string", enum: ["sync", "async", "data"] },
          volumePerMonth: { type: "number", description: "Requests or GB per month" },
        },
        required: ["from", "to", "kind"],
        additionalProperties: false,
      },
      execute: ({ from, to, kind, volumePerMonth }) => {
        if (!nodeOr(from)) return noNode(from);
        if (!nodeOr(to)) return noNode(to);
        const s = useStore.getState();
        const dup = s.edges.find((e) => e.from === from && e.to === to);
        if (dup)
          return errorResult("duplicate_edge", `Edge ${String(from)}→${String(to)} already exists as "${dup.id}".`);
        const id = s.addEdge(
          String(from),
          String(to),
          kind as EdgeKind,
          typeof volumePerMonth === "number" ? volumePerMonth : undefined,
        );
        return text({ id });
      },
    },
    {
      name: "set_property",
      description:
        "Change one setting on a node (console vocabulary — see list_services). Returns the node's new monthly cost. Invalid values return a structured error.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string" },
          key: { type: "string" },
          value: { description: "New value; type per the setting schema" },
        },
        required: ["id", "key", "value"],
        additionalProperties: false,
      },
      execute: ({ id, key, value }) => {
        const node = nodeOr(id);
        if (!node) return noNode(id);
        const def = getService(node.service);
        if (!def) return errorResult("internal", "service definition missing");
        const err = validateSetting(def, String(key), value);
        if (err) return errorResult(err.code, err.message, err);
        useStore.getState().setNodeSetting(node.id, String(key), value);
        const s = useStore.getState();
        const cost = nodeCost(snapshotOf(s), node.id, pricingOf(s));
        return text({
          id: node.id,
          monthly: money(cost.monthly),
          monthlyTotal: money(monthlyTotal(snapshotOf(s), pricingOf(s))),
        });
      },
    },
    {
      name: "set_traffic",
      description:
        "Set the canvas-wide traffic assumption. Nodes without explicit volume settings derive from it. Returns the recalculated total.",
      inputSchema: {
        type: "object",
        properties: {
          requestsPerMonth: { type: "number", minimum: 0 },
          avgPayloadKb: { type: "number", minimum: 0 },
        },
        additionalProperties: false,
      },
      execute: ({ requestsPerMonth, avgPayloadKb }) => {
        const patch: Record<string, number> = {};
        if (typeof requestsPerMonth === "number") patch.requestsPerMonth = requestsPerMonth;
        if (typeof avgPayloadKb === "number") patch.avgPayloadKb = avgPayloadKb;
        if (!Object.keys(patch).length)
          return errorResult("no_change", "Pass requestsPerMonth and/or avgPayloadKb.");
        useStore.getState().setTraffic(patch);
        const s = useStore.getState();
        return text({
          traffic: s.traffic,
          monthlyTotal: money(monthlyTotal(snapshotOf(s), pricingOf(s))),
        });
      },
    },
    {
      name: "remove_node",
      description: "Remove a node; its edges are cleaned up with it.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
        additionalProperties: false,
      },
      execute: ({ id }) => {
        const node = nodeOr(id);
        if (!node) return noNode(id);
        const before = useStore.getState().edges.length;
        useStore.getState().removeNode(node.id);
        const s = useStore.getState();
        return text({
          removed: node.id,
          edgesRemoved: before - s.edges.length,
          monthlyTotal: money(monthlyTotal(snapshotOf(s), pricingOf(s))),
        });
      },
    },
    {
      name: "apply_pattern",
      description:
        "Apply a cost/reliability pattern across the canvas: arm64, http_api, express_workflows, provisioned_capacity, cdn_in_front, dlq_everywhere.",
      inputSchema: {
        type: "object",
        properties: { pattern: { type: "string", enum: [...PATTERNS] } },
        required: ["pattern"],
        additionalProperties: false,
      },
      execute: ({ pattern }) => {
        const s = useStore.getState();
        const changed: string[] = [];
        switch (pattern) {
          case "arm64":
            for (const n of s.nodes)
              if (n.service === "lambda" && n.settings.architecture !== "arm64") {
                s.setNodeSetting(n.id, "architecture", "arm64");
                changed.push(n.id);
              }
            break;
          case "http_api":
            for (const n of s.nodes)
              if (n.service === "apigateway" && n.settings.apiType !== "HTTP") {
                s.setNodeSetting(n.id, "apiType", "HTTP");
                changed.push(n.id);
              }
            break;
          case "express_workflows":
            for (const n of s.nodes)
              if (n.service === "stepfunctions" && n.settings.workflowType !== "express") {
                s.setNodeSetting(n.id, "workflowType", "express");
                changed.push(n.id);
              }
            break;
          case "provisioned_capacity":
            for (const n of s.nodes)
              if (n.service === "dynamodb" && n.settings.capacityMode !== "provisioned") {
                s.setNodeSetting(n.id, "capacityMode", "provisioned");
                changed.push(n.id);
              }
            break;
          case "dlq_everywhere":
            for (const n of s.nodes)
              if (
                (n.service === "lambda" || n.service === "sqs") &&
                n.settings.dlqConfigured !== true
              ) {
                s.setNodeSetting(n.id, "dlqConfigured", true);
                changed.push(n.id);
              }
            break;
          case "cdn_in_front": {
            const buckets = s.nodes.filter(
              (n) =>
                n.service === "s3" &&
                n.settings.publiclyServed === true &&
                !s.edges.some(
                  (e) => e.to === n.id && nodeOr(e.from)?.service === "cloudfront",
                ),
            );
            if (!buckets.length)
              return errorResult(
                "nothing_to_change",
                "No publicly served S3 bucket lacks a CloudFront in front.",
              );
            for (const b of buckets) {
              const cdnId = s.addNode("cloudfront", `${b.name}-cdn`);
              useStore.getState().addEdge(cdnId, b.id, "data");
              changed.push(cdnId);
            }
            break;
          }
          default:
            return errorResult("no_such_pattern", `Unknown pattern.`, { patterns: PATTERNS });
        }
        const after = useStore.getState();
        return text({
          pattern,
          changedNodes: changed,
          monthlyTotal: money(monthlyTotal(snapshotOf(after), pricingOf(after))),
        });
      },
    },
    {
      name: "auto_layout",
      description:
        "Re-place every node into its lane: Ingress → Handlers → Messaging → Workers → Data, left to right.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      execute: () => {
        useStore.getState().applyAutoLayout();
        return text({ ok: true, nodes: useStore.getState().nodes.length });
      },
    },
    {
      name: "set_layer",
      description:
        "Toggle a diagram layer: request, events, data, security, cost. Cost on switches nodes to cards.",
      inputSchema: {
        type: "object",
        properties: {
          layer: { type: "string", enum: ["request", "events", "data", "security", "cost"] },
          on: { type: "boolean" },
        },
        required: ["layer", "on"],
        additionalProperties: false,
      },
      execute: ({ layer, on }) => {
        useStore.getState().setLayer(layer as Layer, Boolean(on));
        return text({ layers: useStore.getState().layers });
      },
    },
    {
      name: "trace_request",
      description:
        "Light up one request's path from a node, following sync then async edges. The canvas highlights it; returns the step list.",
      inputSchema: {
        type: "object",
        properties: { fromNodeId: { type: "string" } },
        required: ["fromNodeId"],
        additionalProperties: false,
      },
      execute: ({ fromNodeId }) => {
        const start = nodeOr(fromNodeId);
        if (!start) return noNode(fromNodeId);
        const s = useStore.getState();
        const visited = new Set<string>([start.id]);
        const steps: string[] = [];
        const queue = [start.id];
        while (queue.length) {
          const cur = queue.shift()!;
          for (const e of s.edges) {
            if (e.from !== cur || visited.has(e.to)) continue;
            visited.add(e.to);
            const a = nodeOr(cur)!;
            const b = nodeOr(e.to)!;
            steps.push(`${a.name} —${e.kind}→ ${b.name}`);
            queue.push(e.to);
          }
        }
        s.setTrace([...visited]);
        return text({ from: start.name, steps, nodesLit: visited.size });
      },
    },
    {
      name: "add_group",
      description:
        "Create a group (logical, vpc, subnet, az). Groups frame their members with official AWS colours, carry a cost subtotal, and can collapse to one card.",
      inputSchema: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["logical", "vpc", "subnet", "az"] },
          name: { type: "string" },
          cidr: { type: "string", description: "Optional CIDR shown on the frame" },
        },
        required: ["kind", "name"],
        additionalProperties: false,
      },
      execute: ({ kind, name, cidr }) => {
        const id = useStore
          .getState()
          .addGroup(kind as "logical", String(name), cidr ? String(cidr) : undefined);
        return text({ id });
      },
    },
    {
      name: "move_into_group",
      description: "Re-parent nodes into a group (or pass null groupId to ungroup).",
      inputSchema: {
        type: "object",
        properties: {
          nodeIds: { type: "array", items: { type: "string" } },
          groupId: { type: ["string", "null"] },
        },
        required: ["nodeIds", "groupId"],
        additionalProperties: false,
      },
      execute: ({ nodeIds, groupId }) => {
        const s = useStore.getState();
        if (groupId !== null && !s.groups.some((g) => g.id === groupId))
          return errorResult("no_such_group", `No group "${String(groupId)}".`, {
            groups: s.groups.map((g) => g.id),
          });
        const ids = (Array.isArray(nodeIds) ? nodeIds : []).map(String);
        const missing = ids.filter((id) => !s.nodes.some((n) => n.id === id));
        if (missing.length)
          return errorResult("no_such_node", `Unknown node(s): ${missing.join(", ")}`);
        s.moveIntoGroup(ids, groupId as string | null);
        return text({ groupId, members: ids.length });
      },
    },
    {
      name: "collapse_group",
      description:
        "Fold a group into one card (icon cluster, member count, subtotal); edges re-route to it.",
      inputSchema: {
        type: "object",
        properties: { groupId: { type: "string" } },
        required: ["groupId"],
        additionalProperties: false,
      },
      execute: ({ groupId }) => {
        const s = useStore.getState();
        const g = s.groups.find((x) => x.id === groupId);
        if (!g)
          return errorResult("no_such_group", `No group "${String(groupId)}".`, {
            groups: s.groups.map((x) => x.id),
          });
        s.setGroupCollapsed(g.id, true);
        return text({ groupId: g.id, collapsed: true });
      },
    },
    {
      name: "expand_group",
      description: "Unfold a collapsed group back to its member nodes.",
      inputSchema: {
        type: "object",
        properties: { groupId: { type: "string" } },
        required: ["groupId"],
        additionalProperties: false,
      },
      execute: ({ groupId }) => {
        const s = useStore.getState();
        const g = s.groups.find((x) => x.id === groupId);
        if (!g)
          return errorResult("no_such_group", `No group "${String(groupId)}".`, {
            groups: s.groups.map((x) => x.id),
          });
        s.setGroupCollapsed(g.id, false);
        return text({ groupId: g.id, collapsed: false });
      },
    },
    {
      name: "import_state",
      description:
        "Replace the whole canvas with a previously exported JSON state (the export tool's json format).",
      inputSchema: {
        type: "object",
        properties: { json: { type: "string", description: "Exported state JSON" } },
        required: ["json"],
        additionalProperties: false,
      },
      execute: ({ json }) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(String(json));
        } catch {
          return errorResult("invalid_json", "The json argument is not valid JSON.");
        }
        const snap = parsed as {
          nodes?: unknown[];
          edges?: unknown[];
          groups?: unknown[];
          traffic?: unknown;
        };
        if (!Array.isArray(snap.nodes) || !Array.isArray(snap.edges))
          return errorResult("invalid_state", "Expected { nodes: [], edges: [], groups: [], traffic: {} }.");
        for (const n of snap.nodes as { service?: string }[]) {
          if (!n.service || !getService(n.service))
            return errorResult("invalid_state", `Node with unknown service "${String(n?.service)}".`, {
              services: Object.keys(SERVICES),
            });
        }
        useStore.getState().loadSnapshot({
          nodes: (snap.nodes ?? []) as never,
          edges: (snap.edges ?? []) as never,
          groups: (snap.groups ?? []) as never,
          traffic: (snap.traffic ?? useStore.getState().traffic) as never,
        });
        useStore.getState().applyAutoLayout();
        const s = useStore.getState();
        return text({
          nodes: s.nodes.length,
          edges: s.edges.length,
          monthlyTotal: money(monthlyTotal(snapshotOf(s), pricingOf(s))),
        });
      },
    },
  ];
}

/** Fill defaults so pattern-created nodes are fully specified (used in tests). */
export function withDefaults(service: string, settings: Record<string, unknown>) {
  const def = getService(service);
  return def ? { ...defaultSettings(def), ...settings } : settings;
}
