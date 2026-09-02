"use client";

// A collapsed container as one 220×84 card: how a forty-resource VPC becomes
// one box on the overview. Edges re-route to it; edges wholly inside it are
// dropped.

import { memo, useMemo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { useStore, pricingOf, snapshotOf } from "@/store/useStore";
import { KIND_META, containerStats } from "@/engine/containers";

export const CARD_W = 220;
export const CARD_H = 84;

export type ContainerCardData = { containerId: string };
export type ContainerCardType = Node<ContainerCardData, "container">;

export const ContainerCard = memo(function ContainerCard({
  data,
}: NodeProps<ContainerCardType>) {
  const container = useStore((s) =>
    s.containers.find((c) => c.id === data.containerId),
  );
  const nodes = useStore((s) => s.nodes);
  const containers = useStore((s) => s.containers);
  const traffic = useStore((s) => s.traffic);
  const region = useStore((s) => s.region);
  const setContainerCollapsed = useStore((s) => s.setContainerCollapsed);

  const stat = useMemo(() => {
    try {
      const s = useStore.getState();
      return containerStats(snapshotOf(s), pricingOf(s)).get(data.containerId);
    } catch {
      return undefined;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, containers, traffic, region, data.containerId]);

  if (!container) return null;
  const meta = KIND_META[container.kind];

  return (
    <div className="overhead-node relative" style={{ width: CARD_W, height: CARD_H }}>
      <Handle id="left" type="target" position={Position.Left} style={{ top: CARD_H / 2 }} />
      <Handle id="top" type="target" position={Position.Top} style={{ left: CARD_W / 2 }} />
      <Handle id="right" type="source" position={Position.Right} style={{ top: CARD_H / 2 }} />
      <Handle id="bottom" type="source" position={Position.Bottom} style={{ left: CARD_W / 2 }} />
      <div
        className="absolute inset-0 cursor-pointer rounded-[10px]"
        style={{ background: "var(--panel)", border: `1.6px solid ${meta.color}` }}
        onDoubleClick={() => setContainerCollapsed(container.id, false)}
        title="Double-click to expand"
      >
        {meta.icon ? (
          <svg className="absolute left-3 top-3" width="26" height="26">
            <use href={`#${meta.icon}`} width="26" height="26" />
          </svg>
        ) : null}
        <div
          className="absolute text-[9.5px] font-semibold uppercase"
          style={{
            left: meta.icon ? 46 : 14,
            top: 14,
            letterSpacing: "0.9px",
            color: meta.color,
          }}
        >
          {meta.label}
        </div>
        <div
          className="absolute truncate text-[13px] font-medium"
          style={{ left: 14, top: 38, right: 14, color: "var(--ink)" }}
        >
          {container.name}
        </div>
        <div
          className="absolute text-[10px]"
          style={{
            left: 14,
            top: 58,
            color: "var(--edge-lab)",
            fontFamily: "var(--font-mono-jb)",
          }}
        >
          {stat ? `${stat.resources} resources · $${stat.monthly.toFixed(2)}/mo` : "empty"}
        </div>
        <button
          className="absolute text-[13px] leading-none"
          style={{ right: 10, bottom: 8, color: "var(--ink-3)" }}
          title={`Expand ${container.name}`}
          onClick={(e) => {
            e.stopPropagation();
            setContainerCollapsed(container.id, false);
          }}
        >
          ⤢
        </button>
      </div>
    </div>
  );
});
