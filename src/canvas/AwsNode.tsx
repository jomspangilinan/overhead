"use client";

// One custom React Flow node, two renderings: the 56px official icon with
// the name beneath (default), or the 200×76 card housing the icon when
// zoomed ≥125% / Cards / Cost. Constant 200×100 hit-box keeps edges stable.

import { memo, useEffect } from "react";
import {
  Handle,
  Position,
  useUpdateNodeInternals,
  type NodeProps,
  type Node,
} from "@xyflow/react";
import { useStore, cardModeOf, pricingOf, snapshotOf } from "@/store/useStore";
import { getService } from "@/engine/services";
import { nodeCost } from "@/engine/cost";
import { findingsForNode } from "@/engine/findings";
import { toMoney, type Severity } from "@/engine/model";

export const NODE_W = 200;
export const NODE_H = 100;
export const ICON = 56;

// Security is a node property, not an edge — shown as a badge when the
// security layer is on.
const SEC_BADGE: Record<string, string> = {
  lambda: "IAM role",
  apigateway: "authorizer",
  dynamodb: "SSE-KMS",
  s3: "SSE-S3",
  cloudfront: "OAC · TLS",
  sqs: "SSE-SQS",
  sns: "SSE",
  eventbridge: "resource policy",
  stepfunctions: "IAM role",
  cognito: "JWT issuer",
};

export type AwsNodeData = { nodeId: string };
export type AwsNodeType = Node<AwsNodeData, "aws">;

function money(n: number): string {
  return `$${toMoney(n).toFixed(2)}`;
}

function settingText(value: unknown, unit?: string): string {
  if (typeof value === "number") {
    const s = value >= 1_000_000 ? `${value / 1_000_000}M` : String(value);
    return unit ? `${s} ${unit}` : s;
  }
  return String(value);
}

/** Re-measure handles when the icon/card mode flips, so edges re-anchor. */
function ModeInternals({ nodeId, cardMode }: { nodeId: string; cardMode: boolean }) {
  const updateNodeInternals = useUpdateNodeInternals();
  useEffect(() => {
    updateNodeInternals(nodeId);
  }, [nodeId, cardMode, updateNodeInternals]);
  return null;
}

export const AwsNode = memo(function AwsNode({ data }: NodeProps<AwsNodeType>) {
  const node = useStore((s) => s.nodes.find((n) => n.id === data.nodeId));
  const cardMode = useStore(cardModeOf);
  const costOn = useStore((s) => s.layers.cost);
  const securityOn = useStore((s) => s.layers.security);
  const monthly = useStore((s) => {
    if (!s.nodes.some((n) => n.id === data.nodeId)) return 0;
    try {
      return nodeCost(snapshotOf(s), data.nodeId, pricingOf(s)).monthly;
    } catch {
      return 0;
    }
  });

  const worst = useStore((s): Severity | null => {
    if (!s.nodes.some((n) => n.id === data.nodeId)) return null;
    try {
      const fs = findingsForNode(snapshotOf(s), pricingOf(s), data.nodeId).filter(
        (f) => f.severity !== "info",
      );
      if (fs.some((f) => f.severity === "critical")) return "critical";
      return fs.length ? "warn" : null;
    } catch {
      return null;
    }
  });

  if (!node) return null;
  const def = getService(node.service);
  if (!def) return null;

  const ringColor =
    worst === "critical" ? "var(--critical)" : worst === "warn" ? "var(--finding)" : null;

  const cardSettings = def.cardLines
    .map((key) => {
      const s = def.settings[key];
      const v = node.settings[key];
      if (v === undefined || !s) return null;
      return settingText(v, s.type === "number" ? s.unit : undefined);
    })
    .filter(Boolean)
    .join(" · ");

  // Icon-mode edges anchor at the 56px icon's rim, not the 200px hit-box —
  // otherwise arrowheads float in empty space. Icon centre sits at y≈39.
  const anchor = cardMode
    ? { left: { top: NODE_H / 2, left: 0 }, right: { top: NODE_H / 2, right: 0 } }
    : {
        left: { top: 39, left: NODE_W / 2 - ICON / 2 - 6 },
        right: { top: 39, right: NODE_W / 2 - ICON / 2 - 6 },
      };

  return (
    <div
      className="overhead-node relative"
      style={{ width: NODE_W, height: NODE_H }}
    >
      <ModeInternals nodeId={data.nodeId} cardMode={cardMode} />
      <Handle type="target" position={Position.Left} style={anchor.left} />
      <Handle type="source" position={Position.Right} style={anchor.right} />
      {cardMode ? (
        <div
          className="absolute overflow-hidden rounded-lg border bg-surface shadow-sm"
          style={{
            left: 0,
            top: (NODE_H - 76) / 2,
            width: 200,
            height: 76,
            borderColor: "var(--rule)",
          }}
        >
          {ringColor ? (
            <div
              className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r"
              style={{ background: ringColor }}
            />
          ) : null}
          <svg width="48" height="48" className="absolute left-3 top-[14px]">
            <use href={`#${def.icon}`} width="48" height="48" />
          </svg>
          <div className="absolute left-[70px] top-[8px] right-2">
            <div
              className="truncate font-head text-[9.5px] font-semibold opacity-65"
              style={{ fontFamily: "var(--font-archivo)" }}
            >
              {def.term}
            </div>
            <div className="truncate text-[12.5px] font-medium leading-4">
              {node.name}
            </div>
            <div
              className="truncate text-[9.5px] opacity-70"
              style={{ fontFamily: "var(--font-plex-mono)" }}
            >
              {cardSettings}
            </div>
          </div>
          {securityOn && SEC_BADGE[node.service] ? (
            <div
              className="absolute bottom-1.5 left-[70px] rounded border px-1 py-px text-[8.5px] font-semibold"
              style={{
                fontFamily: "var(--font-plex-mono)",
                borderColor: "var(--rule)",
                color: "var(--ink-2)",
              }}
            >
              {SEC_BADGE[node.service]}
            </div>
          ) : null}
          <div
            className="absolute bottom-1.5 right-2.5 text-[11px] font-semibold"
            style={{ fontFamily: "var(--font-plex-mono)" }}
          >
            {money(monthly)}
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center">
          <div
            className="rounded-[11px]"
            style={{
              marginTop: (NODE_H - ICON - 22) / 2 - 4,
              padding: 4,
              boxShadow: ringColor ? `0 0 0 2.5px ${ringColor}` : undefined,
            }}
          >
            <svg width={ICON} height={ICON} style={{ display: "block" }}>
              <use href={`#${def.icon}`} width={ICON} height={ICON} />
            </svg>
          </div>
          <div className="mt-1 max-w-[190px] truncate text-center text-[12px] font-medium">
            {node.name}
          </div>
          {securityOn && SEC_BADGE[node.service] ? (
            <div
              className="rounded border px-1 py-px text-[8.5px] font-semibold"
              style={{
                fontFamily: "var(--font-plex-mono)",
                borderColor: "var(--rule)",
                color: "var(--ink-2)",
                background: "var(--surface)",
              }}
            >
              {SEC_BADGE[node.service]}
            </div>
          ) : null}
          {costOn ? (
            <div
              className="text-[10.5px] font-semibold"
              style={{ fontFamily: "var(--font-plex-mono)" }}
            >
              {money(monthly)}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
});
