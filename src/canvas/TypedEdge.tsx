"use client";

// One edge component. `kind` (semantic) decides the default look; a
// per-edge `style` pins what the user changed (dash, arrowheads, weight,
// shape) and is never read for meaning. Routing is "floating": anchors come
// from the nodes' live positions and visual shape via edgeGeometry · React
// Flow's handle coordinates are ignored. The canvas picks the sides so fans
// group per side.
//
// Selected, an edge shows its waypoints (drag to move, double-click or
// Delete to remove), a "+" on every segment to add one, a styling toolbar
// above the label, and double-click on the label edits it in place.

import { memo, useRef, useState } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  useInternalNode,
  useReactFlow,
  type Edge,
  type EdgeProps,
} from "@xyflow/react";
import type { EdgeKind, EdgeStyle, Side } from "@/engine/model";
import { dashOf } from "@/engine/model";
import { useStore, cardModeOf } from "@/store/useStore";
import { NODE_W, NODE_H } from "./nodeMetrics";
import { buildEdge, loopPath, shapeOf, type CaseKind, type P, type Side4 } from "./edgeGeometry";
import { DASH, widthFor, volumeLabel } from "./edgeStyle";
import { EdgeStylePicker } from "./EdgeStylePicker";
import { Icon } from "./Icon";

export type TypedEdgeData = {
  kind: EdgeKind;
  volumePerMonth?: number;
  label?: string;
  style?: EdgeStyle;
  waypoints?: P[];
  anchors?: { from?: Side; to?: Side };
  /** Sides picked by the canvas (so fans group per side). */
  sides?: { from: Side4; to: Side4; caseKind: CaseKind };
  /** This edge's slot among the edges leaving its source / entering its target. */
  fan?: { sIdx: number; sCount: number; tIdx: number; tCount: number };
};
export type TypedEdgeType = Edge<TypedEdgeData, "typed">;

/** Spread the anchors so arrowheads meeting one node don't stack; keep the
 *  whole fan inside the icon (icon mode) or card (card mode). */
export function fanOffset(idx: number, count: number, cardMode: boolean): number {
  if (count <= 1) return 0;
  const base = cardMode ? 16 : 14;
  const maxSpread = cardMode ? 48 : 40;
  const spacing = Math.min(base, maxSpread / (count - 1));
  return (idx - (count - 1) / 2) * spacing;
}

export { widthFor };

export const TypedEdge = memo(function TypedEdge({
  id,
  source,
  target,
  data,
  markerEnd,
  markerStart,
  selected,
}: EdgeProps<TypedEdgeType>) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  const cardMode = useStore(cardModeOf);
  const zoom = useStore((st) => st.zoom);
  const setEdge = useStore((st) => st.setEdge);
  const setWaypoints = useStore((st) => st.setWaypoints);
  const removeWaypoint = useStore((st) => st.removeWaypoint);
  const removeEdge = useStore((st) => st.removeEdge);
  const selectEdge = useStore((st) => st.selectEdge);
  const selectedWaypoint = useStore((st) => st.selectedWaypoint);
  const setSelectedWaypoint = useStore((st) => st.setSelectedWaypoint);
  const editingLabel = useStore((st) => st.labelEditingEdgeId === id);
  const setLabelEditing = useStore((st) => st.setLabelEditing);
  const edge = useStore((st) => st.edges.find((e) => e.id === id));
  const { screenToFlowPosition } = useReactFlow();
  // Bracket edges reach outward · away from the graph's centre of mass.
  const graphCx = useStore((st) =>
    st.nodes.length ? st.nodes.reduce((a, n) => a + n.position.x, 0) / st.nodes.length : 0,
  );
  const [preview, setPreview] = useState<P[] | null>(null);
  const drag = useRef<{ idx: number; pts: P[]; moved: boolean } | null>(null);

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
  const waypoints = preview ?? data?.waypoints;
  const geo =
    source === target
      ? loopPath(s, fan?.sIdx ?? 0)
      : buildEdge(s, t, {
          waypoints,
          shape: data?.style?.shape,
          from: data?.anchors?.from,
          to: data?.anchors?.to,
          sides: data?.sides,
          outwardK,
          sourceOffset: fan ? fanOffset(fan.sIdx, fan.sCount, cardMode) : 0,
          targetOffset: fan ? fanOffset(fan.tIdx, fan.tCount, cardMode) : 0,
        });

  const label = data?.label ?? volumeLabel(data?.volumePerMonth);
  const dash = dashOf({ kind, style: data?.style });
  const width = data?.style?.width ?? widthFor(data?.volumePerMonth);
  const inner = geo.points.slice(1, -1); // the waypoints, as drawn
  const canRoute = source !== target;

  const flowPos = (e: React.PointerEvent) => screenToFlowPosition({ x: e.clientX, y: e.clientY });
  const startDrag = (e: React.PointerEvent, pts: P[], idx: number) => {
    e.stopPropagation();
    e.preventDefault();
    drag.current = { idx, pts, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
    setPreview(pts);
  };
  const moveDrag = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    d.moved = true;
    const p = flowPos(e);
    const pts = d.pts.map((q, i) => (i === d.idx ? p : q));
    d.pts = pts;
    setPreview(pts);
  };
  const endDrag = () => {
    const d = drag.current;
    drag.current = null;
    setPreview(null);
    if (!d) return;
    setWaypoints(id, d.pts);
    setSelectedWaypoint(d.idx);
  };
  const cancelDrag = () => {
    drag.current = null;
    setPreview(null);
  };

  const unscale = `scale(${1 / Math.max(0.5, zoom)})`;

  return (
    <>
      <BaseEdge
        id={id}
        path={geo.d}
        markerEnd={markerEnd}
        markerStart={markerStart}
        style={{ strokeWidth: width, strokeDasharray: DASH[dash], strokeLinecap: "round" }}
      />
      {label || editingLabel ? (
        <EdgeLabelRenderer>
          <div
            className={`absolute rounded px-1 text-[10px] ${selected ? "nodrag nopan" : "pointer-events-none"}`}
            style={{
              transform: `translate(-50%, -50%) translate(${geo.label.x}px, ${geo.label.y}px)`,
              color: "var(--ink-2)",
              background: "var(--bg)",
              pointerEvents: selected ? "all" : "none",
              cursor: selected ? "text" : undefined,
            }}
            title={selected ? "Double-click to edit the label" : undefined}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setLabelEditing(id);
            }}
          >
            {editingLabel ? (
              <input
                autoFocus
                defaultValue={edge?.label ?? ""}
                placeholder="label"
                className="nodrag nopan w-[110px] bg-transparent text-center outline-none"
                style={{ color: "var(--ink)" }}
                onPointerDown={(e) => e.stopPropagation()}
                onBlur={(e) => {
                  setEdge(id, { label: e.target.value.trim() || undefined });
                  setLabelEditing(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  if (e.key === "Escape") setLabelEditing(null);
                }}
              />
            ) : (
              label
            )}
          </div>
        </EdgeLabelRenderer>
      ) : null}
      {selected ? (
        <EdgeLabelRenderer>
          {/* waypoints */}
          {canRoute
            ? inner.map((p, i) => (
                <div
                  key={`wp-${i}`}
                  className="oh-route-handle nodrag nopan absolute rounded-full"
                  style={{
                    width: 12,
                    height: 12,
                    transform: `translate(-50%, -50%) translate(${p.x}px, ${p.y}px)`,
                    background: selectedWaypoint === i ? "var(--accent-ink)" : "var(--accent)",
                    border: "2px solid var(--panel)",
                    boxShadow: "0 0 0 1px var(--accent)",
                    pointerEvents: "all",
                  }}
                  title="Drag to move · double-click or Delete to remove"
                  onPointerDown={(e) => startDrag(e, [...(waypoints ?? [])], i)}
                  onPointerMove={moveDrag}
                  onPointerUp={(e) => {
                    const d = drag.current;
                    if (d && !d.moved) {
                      drag.current = null;
                      setPreview(null);
                      setSelectedWaypoint(i);
                      return;
                    }
                    endDrag();
                    void e;
                  }}
                  onPointerCancel={cancelDrag}
                  onLostPointerCapture={() => {
                    if (drag.current) cancelDrag();
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    removeWaypoint(id, i);
                  }}
                />
              ))
            : null}
          {/* "+" on every segment: press to add a waypoint there and drag it */}
          {canRoute
            ? geo.mids.map((m, i) => (
                <div
                  key={`mid-${i}`}
                  className="oh-route-add nodrag nopan absolute grid place-items-center rounded-full"
                  style={{
                    width: 14,
                    height: 14,
                    transform: `translate(-50%, -50%) translate(${m.x}px, ${m.y}px)`,
                    background: "var(--panel)",
                    border: "1.5px dashed var(--accent)",
                    color: "var(--accent-ink)",
                    pointerEvents: "all",
                    fontSize: 10,
                    lineHeight: 1,
                  }}
                  title="Add a bend point here"
                  onPointerDown={(e) => {
                    const wp = [...(waypoints ?? [])];
                    wp.splice(i, 0, { x: Math.round(m.x), y: Math.round(m.y) });
                    startDrag(e, wp, i);
                  }}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={cancelDrag}
                  onLostPointerCapture={() => {
                    if (drag.current) cancelDrag();
                  }}
                >
                  +
                </div>
              ))
            : null}
          {/* styling toolbar, constant screen size, above the label */}
          {edge && !editingLabel ? (
            <div
              className="oh-edge-toolbar glass nodrag nopan absolute flex items-center gap-0.5 rounded-lg p-[3px]"
              style={{
                transform: `translate(-50%, -100%) translate(${geo.label.x}px, ${geo.label.y - 14}px) ${unscale}`,
                transformOrigin: "50% 100%",
                pointerEvents: "all",
                zIndex: 5,
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
            >
              <EdgeStylePicker edge={edge} compact tipPos="bottom" />
              <span className="mx-1 h-4 w-px self-center" style={{ background: "var(--line-2)" }} />
              <button
                data-tip="Edit label"
                data-tip-pos="bottom"
                aria-label="Edit label"
                className="grid h-[26px] w-[26px] place-items-center rounded-md hover:bg-[var(--hover-2)]"
                style={{ color: "var(--ink-2)" }}
                onClick={() => setLabelEditing(id)}
              >
                <span className="text-[11px] font-semibold">T</span>
              </button>
              {data?.waypoints?.length ? (
                <button
                  data-tip="Straighten · remove all bend points"
                  data-tip-pos="bottom"
                  aria-label="Remove all bend points"
                  className="grid h-[26px] w-[26px] place-items-center rounded-md hover:bg-[var(--hover-2)]"
                  style={{ color: "var(--ink-2)" }}
                  onClick={() => setWaypoints(id, undefined)}
                >
                  <Icon name="fit" size={12} />
                </button>
              ) : null}
              <button
                data-tip="Remove edge · ⌫"
                data-tip-pos="bottom"
                aria-label="Remove edge"
                className="grid h-[26px] w-[26px] place-items-center rounded-md hover:bg-[var(--hover-2)]"
                style={{ color: "var(--bad)" }}
                onClick={() => {
                  removeEdge(id);
                  selectEdge(null);
                }}
              >
                <span className="text-[13px] leading-none">×</span>
              </button>
            </div>
          ) : null}
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
});
