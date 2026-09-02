"use client";

// The three edge kinds, three encodings, nothing else:
// sync = solid + arrowhead · async = dashed 7 5 + arrowhead ·
// data = dotted 2 5, no head. Routing is "floating": anchors are computed
// from the nodes' live positions and visual shape (icon rim / card edge)
// via edgeGeometry — React Flow's handle coordinates are ignored.

import { memo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  useInternalNode,
  type Edge,
  type EdgeProps,
} from "@xyflow/react";
import type { EdgeKind } from "@/engine/model";
import { useStore, cardModeOf } from "@/store/useStore";
import { NODE_W, NODE_H } from "./AwsNode";
import { edgeGeometry, shapeOf } from "./edgeGeometry";

export type TypedEdgeData = {
  kind: EdgeKind;
  volumePerMonth?: number;
  label?: string;
};
export type TypedEdgeType = Edge<TypedEdgeData, "typed">;

/** Stroke width follows volume on a log scale, 1.2 → 3.5 px. */
function widthFor(volume?: number): number {
  if (!volume || volume <= 0) return 1.4;
  const t = Math.min(1, Math.max(0, (Math.log10(volume) - 3) / 5));
  return 1.2 + t * 2.3;
}

function volumeLabel(volume?: number): string | null {
  if (!volume) return null;
  if (volume >= 1_000_000) return `${+(volume / 1_000_000).toFixed(1)}M/mo`;
  if (volume >= 1_000) return `${+(volume / 1_000).toFixed(0)}k/mo`;
  return `${volume}/mo`;
}

export const TypedEdge = memo(function TypedEdge({
  id,
  source,
  target,
  data,
  markerEnd,
}: EdgeProps<TypedEdgeType>) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  const cardMode = useStore(cardModeOf);
  // Bracket edges reach outward — away from the graph's centre of mass.
  const graphCx = useStore((st) =>
    st.nodes.length
      ? st.nodes.reduce((a, n) => a + n.position.x, 0) / st.nodes.length
      : 0,
  );

  if (!sourceNode || !targetNode) return null;

  const kind = data?.kind ?? "sync";
  const s = shapeOf(
    sourceNode.internals.positionAbsolute,
    sourceNode.measured?.width ?? NODE_W,
    sourceNode.measured?.height ?? NODE_H,
    cardMode || sourceNode.type === "awsGroup",
  );
  const t = shapeOf(
    targetNode.internals.positionAbsolute,
    targetNode.measured?.width ?? NODE_W,
    targetNode.measured?.height ?? NODE_H,
    cardMode || targetNode.type === "awsGroup",
  );
  const outwardK = (s.cx + t.cx) / 2 >= graphCx ? (1 as const) : (-1 as const);
  const geo = edgeGeometry(s, t, { outwardK });

  const label = data?.label ?? volumeLabel(data?.volumePerMonth);

  return (
    <>
      <BaseEdge
        id={id}
        path={geo.d}
        markerEnd={kind === "data" ? undefined : markerEnd}
        style={{
          strokeWidth: widthFor(data?.volumePerMonth),
          strokeDasharray:
            kind === "async" ? "7 5" : kind === "data" ? "2 5" : undefined,
          strokeLinecap: "round",
        }}
      />
      {label ? (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none absolute rounded px-1 text-[10px]"
            style={{
              transform: `translate(-50%, -50%) translate(${geo.label.x}px, ${geo.label.y}px)`,
              color: "var(--ink-2)",
              background: "var(--bg)",
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
});
