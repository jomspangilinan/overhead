"use client";

// The three edge kinds, three encodings, nothing else:
// sync = solid + arrowhead · async = dashed 7 5 + arrowhead ·
// data = dotted 2 5, no head. That mapping is the default; a per-edge
// `style` pins what the user changed by hand (weight, dash, arrowhead).
// Routing is "floating": anchors are computed from the nodes' live
// positions and visual shape (icon rim / card edge) via edgeGeometry —
// React Flow's handle coordinates are ignored. A selected edge shows a
// midpoint handle; drag it and the curve bends through that point and
// stays there (`route`), double-click to let go.

import { memo, useRef, useState } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  useInternalNode,
  useReactFlow,
  type Edge,
  type EdgeProps,
} from "@xyflow/react";
import type { EdgeKind, EdgeStyle } from "@/engine/model";
import { useStore, cardModeOf } from "@/store/useStore";
import { NODE_W, NODE_H } from "./AwsNode";
import { edgeGeometry, routedPath, shapeOf } from "./edgeGeometry";

export type TypedEdgeData = {
  kind: EdgeKind;
  volumePerMonth?: number;
  label?: string;
  style?: EdgeStyle;
  route?: { x: number; y: number };
  /** This edge's slot among the edges leaving its source / entering its target. */
  fan?: { sIdx: number; sCount: number; tIdx: number; tCount: number };
};

/** Spread the anchors so arrowheads meeting one node don't stack; keep the
 *  whole fan inside the icon (icon mode) or card (card mode). */
function fanOffset(idx: number, count: number, cardMode: boolean): number {
  if (count <= 1) return 0;
  const base = cardMode ? 16 : 14;
  const maxSpread = cardMode ? 48 : 40;
  const spacing = Math.min(base, maxSpread / (count - 1));
  return (idx - (count - 1) / 2) * spacing;
}
export type TypedEdgeType = Edge<TypedEdgeData, "typed">;

/** Stroke width follows volume on a log scale, 1.2 → 3.5 px. */
export function widthFor(volume?: number): number {
  if (!volume || volume <= 0) return 1.4;
  const t = Math.min(1, Math.max(0, (Math.log10(volume) - 3) / 5));
  return 1.2 + t * 2.3;
}

export const DASH: Record<NonNullable<EdgeStyle["dash"]>, string | undefined> = {
  solid: undefined,
  dashed: "7 5",
  dotted: "2 5",
};

/** The kind's default dash — the semantic encoding. */
export function dashFor(kind: EdgeKind): NonNullable<EdgeStyle["dash"]> {
  return kind === "async" ? "dashed" : kind === "data" ? "dotted" : "solid";
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
  selected,
}: EdgeProps<TypedEdgeType>) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  const cardMode = useStore(cardModeOf);
  const setEdge = useStore((st) => st.setEdge);
  const { screenToFlowPosition } = useReactFlow();
  // Bracket edges reach outward — away from the graph's centre of mass.
  const graphCx = useStore((st) =>
    st.nodes.length
      ? st.nodes.reduce((a, n) => a + n.position.x, 0) / st.nodes.length
      : 0,
  );
  const [preview, setPreview] = useState<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);

  if (!sourceNode || !targetNode) return null;

  const kind = data?.kind ?? "sync";
  const s = shapeOf(
    sourceNode.internals.positionAbsolute,
    sourceNode.measured?.width ?? NODE_W,
    sourceNode.measured?.height ?? NODE_H,
    cardMode || sourceNode.type === "container",
  );
  const t = shapeOf(
    targetNode.internals.positionAbsolute,
    targetNode.measured?.width ?? NODE_W,
    targetNode.measured?.height ?? NODE_H,
    cardMode || targetNode.type === "container",
  );
  const outwardK = (s.cx + t.cx) / 2 >= graphCx ? (1 as const) : (-1 as const);
  const fan = data?.fan;
  const geo = edgeGeometry(s, t, {
    outwardK,
    sourceOffset: fan ? fanOffset(fan.sIdx, fan.sCount, cardMode) : 0,
    targetOffset: fan ? fanOffset(fan.tIdx, fan.tCount, cardMode) : 0,
  });

  const route = preview ?? data?.route;
  const routed = route ? routedPath(geo.p0, geo.p3, route) : null;
  const d = routed?.d ?? geo.d;
  const labelAt = routed?.label ?? geo.label;
  // The handle sits on the curve's midpoint: the pinned point, else the
  // default curve's own midpoint (label anchor, un-nudged).
  const handleAt = route ?? { x: geo.label.x, y: geo.caseKind === "bracket" ? geo.label.y : geo.label.y + 10 };

  const label = data?.label ?? volumeLabel(data?.volumePerMonth);
  const style = data?.style;
  const dash = style?.dash ?? dashFor(kind);
  const width = style?.width ?? widthFor(data?.volumePerMonth);

  return (
    <>
      <BaseEdge
        id={id}
        path={d}
        markerEnd={markerEnd}
        style={{
          strokeWidth: width,
          strokeDasharray: DASH[dash],
          strokeLinecap: "round",
        }}
      />
      {label ? (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none absolute rounded px-1 text-[10px]"
            style={{
              transform: `translate(-50%, -50%) translate(${labelAt.x}px, ${labelAt.y}px)`,
              color: "var(--ink-2)",
              background: "var(--bg)",
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
      {selected ? (
        <EdgeLabelRenderer>
          <div
            className="oh-route-handle nodrag nopan absolute rounded-full"
            style={{
              width: 12,
              height: 12,
              transform: `translate(-50%, -50%) translate(${handleAt.x}px, ${handleAt.y}px)`,
              background: data?.route ? "var(--accent)" : "var(--panel)",
              border: "2px solid var(--accent)",
              pointerEvents: "all",
            }}
            title={data?.route ? "Drag to re-route · double-click to reset" : "Drag to bend this edge"}
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              dragging.current = true;
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (!dragging.current) return;
              setPreview(screenToFlowPosition({ x: e.clientX, y: e.clientY }));
            }}
            onPointerUp={(e) => {
              if (!dragging.current) return;
              dragging.current = false;
              const p = screenToFlowPosition({ x: e.clientX, y: e.clientY });
              setPreview(null);
              setEdge(id, { route: { x: Math.round(p.x), y: Math.round(p.y) } });
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEdge(id, { route: undefined });
            }}
          />
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
});
