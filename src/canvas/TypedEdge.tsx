"use client";

// The three edge kinds, three encodings, nothing else:
// sync = solid + arrowhead · async = dashed 7 5 + arrowhead ·
// data = dotted 2 5, no head. All cubic beziers — same-column edges
// bracket out one side; everything else curves left → right.

import { memo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  type Edge,
  type EdgeProps,
} from "@xyflow/react";
import type { EdgeKind } from "@/engine/model";

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
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  markerEnd,
}: EdgeProps<TypedEdgeType>) {
  const kind = data?.kind ?? "sync";

  let d: string;
  let labX: number;
  let labY: number;
  if (targetX - sourceX < 24) {
    // same column (or backwards): bracket out one side
    const reach = 80;
    d = `M${sourceX},${sourceY} C${sourceX + reach},${sourceY} ${targetX + reach},${targetY} ${targetX},${targetY}`;
    labX = Math.max(sourceX, targetX) + reach * 0.7;
    labY = (sourceY + targetY) / 2;
  } else {
    const dx = Math.max(24, targetX - sourceX);
    d = `M${sourceX},${sourceY} C${sourceX + dx * 0.5},${sourceY} ${targetX - dx * 0.5},${targetY} ${targetX},${targetY}`;
    labX = (sourceX + targetX) / 2;
    labY = (sourceY + targetY) / 2 - 10;
  }

  const label = data?.label ?? volumeLabel(data?.volumePerMonth);

  return (
    <>
      <BaseEdge
        id={id}
        path={d}
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
            className="pointer-events-none absolute text-[10px]"
            style={{
              transform: `translate(-50%, -50%) translate(${labX}px, ${labY}px)`,
              color: "var(--ink-2)",
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
});
