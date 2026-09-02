"use client";

// A collapsed frame as one 220×84 card: how a forty-resource VPC becomes
// one box on the overview. Containers and sections both collapse this way.
// Edges re-route to it; edges wholly inside it are dropped. A frame with
// nothing inside collapses too (it sits where its rectangle was), so
// collapsing an empty VPC never makes it disappear.

import { memo, useMemo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { useStore, pricingOf, snapshotOf } from "@/store/useStore";
import { KIND_META, containerStats } from "@/engine/containers";

export const CARD_W = 220;
export const CARD_H = 84;

export type FrameCardData = { frameKind: "container" | "section"; frameId: string };
export type FrameCardType = Node<FrameCardData, "frame">;

export const FrameCard = memo(function FrameCard({ data, selected }: NodeProps<FrameCardType>) {
  const { frameKind, frameId } = data;
  const container = useStore((s) => (frameKind === "container" ? s.containers.find((c) => c.id === frameId) : undefined));
  const section = useStore((s) => (frameKind === "section" ? s.sections.find((x) => x.id === frameId) : undefined));
  const nodes = useStore((s) => s.nodes);
  const containers = useStore((s) => s.containers);
  const traffic = useStore((s) => s.traffic);
  const region = useStore((s) => s.region);
  const setContainerCollapsed = useStore((s) => s.setContainerCollapsed);
  const setSectionCollapsed = useStore((s) => s.setSectionCollapsed);

  const stat = useMemo(() => {
    if (frameKind !== "container") return undefined;
    try {
      const s = useStore.getState();
      return containerStats(snapshotOf(s), pricingOf(s)).get(frameId);
    } catch {
      return undefined;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, containers, traffic, region, frameId, frameKind]);

  if (!container && !section) return null;
  const color = container ? KIND_META[container.kind].color : section!.color;
  const icon = container ? KIND_META[container.kind].icon : null;
  const kindLabel = container ? KIND_META[container.kind].label : "Section";
  const name = container ? container.name : section!.name;
  const count = container ? stat?.resources ?? 0 : section!.nodeIds.length;
  const detail = container
    ? stat && stat.resources
      ? `${stat.resources} resources · $${stat.monthly.toFixed(2)}/mo`
      : "empty"
    : `${count} ${count === 1 ? "resource" : "resources"}`;
  const expand = () => (container ? setContainerCollapsed(container.id, false) : setSectionCollapsed(section!.id, false));

  return (
    <div className="overhead-node relative" style={{ width: CARD_W, height: CARD_H }}>
      <Handle id="left" type="target" position={Position.Left} style={{ top: CARD_H / 2 }} />
      <Handle id="top" type="target" position={Position.Top} style={{ left: CARD_W / 2 }} />
      <Handle id="right" type="source" position={Position.Right} style={{ top: CARD_H / 2 }} />
      <Handle id="bottom" type="source" position={Position.Bottom} style={{ left: CARD_W / 2 }} />
      <div
        className="absolute inset-0 cursor-pointer rounded-[10px]"
        style={{
          background: "var(--panel)",
          border: `1.6px ${container ? "solid" : "dashed"} ${selected ? "var(--accent)" : color}`,
          boxShadow: selected ? "0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent)" : undefined,
        }}
        onDoubleClick={expand}
        title={`${kindLabel} · collapsed · click to select · double-click to expand`}
      >
        {icon ? (
          <svg className="absolute left-3 top-3" width="26" height="26">
            <use href={`#${icon}`} width="26" height="26" />
          </svg>
        ) : (
          <span className="absolute left-3 top-3 block h-[26px] w-[26px] rounded-[5px]" style={{ border: `1.5px dashed ${color}` }} />
        )}
        <div className="absolute text-[9.5px] font-semibold uppercase" style={{ left: 46, top: 14, letterSpacing: "0.9px", color }}>
          {kindLabel}
        </div>
        <div className="absolute truncate text-[13px] font-medium" style={{ left: 14, top: 38, right: 40, color: "var(--ink)" }}>
          {name}
        </div>
        <div className="absolute text-[10px]" style={{ left: 14, top: 58, color: "var(--edge-lab)", fontFamily: "var(--font-mono-jb)" }}>
          {detail}
        </div>
        <button
          className="oh-card-expand nodrag nopan absolute grid h-[22px] w-[22px] place-items-center rounded-md"
          style={{ right: 8, bottom: 8, border: `1px solid ${color}`, color, background: "var(--panel)" }}
          title={`Expand ${name}`}
          aria-label={`Expand ${name}`}
          onClick={(e) => {
            e.stopPropagation();
            expand();
          }}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2H2v4M2 2l5 5M10 14h4v-4M14 14l-5-5" />
          </svg>
        </button>
      </div>
    </div>
  );
});
