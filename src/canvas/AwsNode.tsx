"use client";

// One custom React Flow node, two renderings: the 56px official icon with
// the name beneath (default), or the 200×76 card housing the icon when
// zoomed ≥125% / Cards / Cost. Constant 200×100 hit-box keeps edges stable.

import { memo, useEffect, useState } from "react";
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
import { formatCost, type Severity } from "@/engine/model";
import { defaultSettings } from "@/engine/defineService";
import { shapeOf, anchorPoint, type Side4 } from "./edgeGeometry";

import { NODE_W, NODE_H, ICON } from "./nodeMetrics";
export { NODE_W, NODE_H, ICON };

// Security is a node property, not an edge · its badge is derived from the
// service's security settings (defineService().badge) and shown when the
// security layer is on.

export type AwsNodeData = { nodeId: string };
export type AwsNodeType = Node<AwsNodeData, "aws">;

function settingText(value: unknown, unit?: string): string {
  if (typeof value === "number") {
    const s = value >= 1_000_000 ? `${value / 1_000_000}M` : String(value);
    return unit ? `${s} ${unit}` : s;
  }
  return String(value);
}

/** Four connection handles (one per side) and, on hover, a "+" pad outside
 *  each: click a pad to add a connected node on that side; drag a handle
 *  to connect to another node, or drop it on empty canvas to add one there.
 *  Icon-mode handles sit at the 56px icon's rim (centre y≈39), not the
 *  200px hit-box · otherwise arrowheads float in empty space. */
const SIDES: { side: Side4; pos: Position }[] = [
  { side: "left", pos: Position.Left },
  { side: "right", pos: Position.Right },
  { side: "top", pos: Position.Top },
  { side: "bottom", pos: Position.Bottom },
];
export function besidePosition(centre: { x: number; y: number }, side: Side4) {
  const dx = side === "right" ? 260 : side === "left" ? -260 : 0;
  const dy = side === "bottom" ? 160 : side === "top" ? -160 : 0;
  return { x: centre.x + dx, y: centre.y + dy };
}
const PAD_PUSH = 20;
const ZONE_MARGIN = 30;
function SideHandles({ nodeId, cardMode, centre }: { nodeId: string; cardMode: boolean; centre: { x: number; y: number } }) {
  const setPendingConnection = useStore((s) => s.setPendingConnection);
  const setPalette = useStore((s) => s.setPalette);
  // The same shape the edges anchor to (edgeGeometry.shapeOf), in node-local
  // coordinates: handles sit exactly where an edge would meet the node and
  // the pads 20px outside them.
  const shape = shapeOf({ x: 0, y: 0 }, NODE_W, NODE_H, cardMode);
  const at = (side: Side4): React.CSSProperties => {
    const p = anchorPoint(shape, side);
    return { top: p.y, left: p.x, transform: "translate(-50%, -50%)" };
  };
  const padAt = (side: Side4): React.CSSProperties => {
    const p = anchorPoint(shape, side);
    return {
      top: p.y + (side === "top" ? -PAD_PUSH : side === "bottom" ? PAD_PUSH : 0),
      left: p.x + (side === "left" ? -PAD_PUSH : side === "right" ? PAD_PUSH : 0),
    };
  };
  return (
    <>
      {SIDES.map(({ side, pos }) => (
        <Handle key={side} id={side} type={side === "left" || side === "top" ? "target" : "source"} position={pos} style={at(side)} />
      ))}
      {/* hover zone: the visible shape plus a margin, so pads appear when the
          pointer approaches the icon/card, not anywhere in the 200×100 hit-box */}
      <div
        className="oh-hover-zone absolute"
        style={{
          left: shape.cx - shape.hw - ZONE_MARGIN,
          top: shape.cy - shape.hh - ZONE_MARGIN,
          width: (shape.hw + ZONE_MARGIN) * 2,
          height: (shape.hh + ZONE_MARGIN) * 2,
          pointerEvents: "none",
        }}
      >
      {SIDES.map(({ side }) => (
        <button
          key={`pad-${side}`}
          className="oh-side-pad nodrag nopan absolute grid h-4 w-4 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-[11px] leading-none"
          style={{ ...padAt(side), left: (padAt(side).left as number) - (shape.cx - shape.hw - ZONE_MARGIN), top: (padAt(side).top as number) - (shape.cy - shape.hh - ZONE_MARGIN), pointerEvents: "auto" }}
          data-tip={`Add a connected service ${side === "left" ? "to the left" : side === "right" ? "to the right" : side === "top" ? "above" : "below"}`}
          data-tip-pos={side === "bottom" ? "bottom" : "top"}
          aria-label={`Add a connected service on the ${side}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            const rect = (e.currentTarget.closest(".oh-main") as HTMLElement | null)?.getBoundingClientRect();
            const r = e.currentTarget.getBoundingClientRect();
            setPendingConnection({
              fromNodeId: nodeId,
              side,
              at: besidePosition(centre, side),
              screen: { x: r.left + r.width / 2 - (rect?.left ?? 0), y: r.top + r.height / 2 - (rect?.top ?? 0) },
            });
            setPalette(true);
          }}
        >
          +
        </button>
      ))}
      </div>
    </>
  );
}

/** Re-measure handles when the icon/card mode flips, so edges re-anchor. */
function ModeInternals({ nodeId, cardMode }: { nodeId: string; cardMode: boolean }) {
  const updateNodeInternals = useUpdateNodeInternals();
  useEffect(() => {
    updateNodeInternals(nodeId);
  }, [nodeId, cardMode, updateNodeInternals]);
  return null;
}

export const AwsNode = memo(function AwsNode({ data, selected }: NodeProps<AwsNodeType>) {
  const node = useStore((s) => s.nodes.find((n) => n.id === data.nodeId));
  const renameNode = useStore((s) => s.renameNode);
  const [editing, setEditing] = useState(false);
  const cardMode = useStore(cardModeOf);
  const costOn = useStore((s) => s.layers.cost);
  const securityOn = useStore((s) => s.layers.security);
  const cardShow = useStore((s) => s.cardShow);
  const costDisplay = useStore((s) => s.costDisplay);
  const setPopover = useStore((s) => s.setPopover);
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
    worst === "critical" ? "var(--bad)" : worst === "warn" ? "var(--warn)" : null;
  const selectRing = selected ? "0 0 0 2px var(--accent), 0 0 0 5px color-mix(in srgb, var(--accent) 25%, transparent)" : null;

  const merged = { ...defaultSettings(def), ...node.settings };
  const badge = securityOn && (node.card?.badge ?? cardShow.badge) ? def.badge?.(merged) ?? null : null;
  const showCost = node.card?.cost ?? cardShow.cost;
  const showSettings = node.card?.lines ? node.card.lines.length > 0 : cardShow.settings;
  const lines = node.card?.lines ?? [...def.cardLines];
  const openGear = (e: React.MouseEvent) => {
    e.stopPropagation();
    const host = (e.currentTarget as HTMLElement).closest(".oh-main")?.getBoundingClientRect();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPopover({ kind: "card", id: node.id, x: r.right - (host?.left ?? 0), y: r.bottom - (host?.top ?? 0) + 4 });
  };
  const gear = (
    <button
      className="gear nodrag nopan absolute grid h-[18px] w-[18px] place-items-center rounded-md"
      style={{ right: cardMode ? 4 : NODE_W / 2 - ICON / 2 - 22, top: cardMode ? (NODE_H - 76) / 2 + 3 : 4, background: "var(--panel)", border: "1px solid var(--line-2)", color: "var(--ink-2)", zIndex: 4 }}
      data-tip="Card & security settings"
      aria-label="Card and security settings"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={openGear}
    >
      <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="8" r="2.4" />
        <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" />
      </svg>
    </button>
  );

  const cardSettings = lines
    .map((key) => {
      const s = def.settings[key];
      const v = node.settings[key];
      if (v === undefined || !s) return null;
      return settingText(v, s.type === "number" ? s.unit : undefined);
    })
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className="overhead-node relative"
      style={{ width: NODE_W, height: NODE_H }}
    >
      <ModeInternals nodeId={data.nodeId} cardMode={cardMode} />
      <SideHandles nodeId={node.id} cardMode={cardMode} centre={node.position} />
      {gear}
      {cardMode ? (
        <div
          className="absolute overflow-hidden rounded-lg border bg-panel shadow-sm"
          style={{
            left: 0,
            top: (NODE_H - 76) / 2,
            width: 200,
            height: 76,
            borderColor: selected ? "var(--accent)" : "var(--line)",
            boxShadow: selectRing ?? undefined,
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
            <div
              className="truncate text-[12.5px] font-medium leading-4"
              title="Double-click to rename"
              onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
            >
              {editing ? (
                <input
                  autoFocus
                  defaultValue={node.name}
                  className="nodrag w-full bg-panel-2 px-1 outline-none"
                  style={{ border: "1px solid var(--accent)" }}
                  onBlur={(e) => { renameNode(node.id, e.target.value); setEditing(false); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    if (e.key === "Escape") setEditing(false);
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                />
              ) : node.name}
            </div>
            <div
              className="truncate text-[9.5px] opacity-70"
              style={{ fontFamily: "var(--font-mono-jb)" }}
            >
              {showSettings ? cardSettings : ""}
            </div>
          </div>
          {badge ? (
            <div
              className="absolute bottom-1.5 left-[70px] rounded border px-1 py-px text-[8.5px] font-semibold"
              style={{
                fontFamily: "var(--font-mono-jb)",
                borderColor: "var(--line)",
                color: "var(--ink-2)",
              }}
            >
              {badge}
            </div>
          ) : null}
          {showCost && costDisplay.nodes ? (
            <div
              className="absolute bottom-1.5 right-2.5 text-[11px] font-semibold"
              style={{ fontFamily: "var(--font-mono-jb)" }}
            >
              {formatCost(monthly, costDisplay)}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center">
          <div
            className="rounded-[11px]"
            style={{
              marginTop: (NODE_H - ICON - 22) / 2 - 4,
              padding: 4,
              boxShadow: selectRing ?? (ringColor ? `0 0 0 2.5px ${ringColor}` : undefined),
              outline: selected && ringColor ? `2.5px solid ${ringColor}` : undefined,
              outlineOffset: 6,
            }}
          >
            <svg width={ICON} height={ICON} style={{ display: "block" }}>
              <use href={`#${def.icon}`} width={ICON} height={ICON} />
            </svg>
          </div>
          {editing ? (
            <input
              autoFocus
              defaultValue={node.name}
              className="nodrag w-[150px] rounded bg-panel-2 px-1 text-center text-[12px] font-medium outline-none"
              style={{ border: "1px solid var(--accent)" }}
              onBlur={(e) => { renameNode(node.id, e.target.value); setEditing(false); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") setEditing(false);
              }}
              onPointerDown={(e) => e.stopPropagation()}
            />
          ) : (
            <div
              className="mt-1 max-w-[190px] truncate text-center text-[12px] font-medium"
              title="Double-click to rename"
              onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
            >
              {node.name}
            </div>
          )}
          {badge ? (
            <div
              className="rounded border px-1 py-px text-[8.5px] font-semibold"
              style={{
                fontFamily: "var(--font-mono-jb)",
                borderColor: "var(--line)",
                color: "var(--ink-2)",
                background: "var(--panel)",
              }}
            >
              {badge}
            </div>
          ) : null}
          {costOn && showCost && costDisplay.nodes ? (
            <div
              className="text-[10.5px] font-semibold"
              style={{ fontFamily: "var(--font-mono-jb)" }}
            >
              {formatCost(monthly, costDisplay)}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
});
