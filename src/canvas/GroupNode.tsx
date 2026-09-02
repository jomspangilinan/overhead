"use client";

// A collapsed group as one card: cluster of member icons, name,
// "N resources", subtotal. Edges re-route to it in Canvas.

import { memo, useMemo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { useStore, pricingOf, snapshotOf } from "@/store/useStore";
import { allCosts } from "@/engine/cost";
import { getService } from "@/engine/services";
import { toMoney } from "@/engine/model";
import { NODE_H } from "./AwsNode";

export type GroupNodeData = { groupId: string };
export type GroupNodeType = Node<GroupNodeData, "awsGroup">;

export const GroupNode = memo(function GroupNode({
  data,
}: NodeProps<GroupNodeType>) {
  const group = useStore((s) => s.groups.find((g) => g.id === data.groupId));
  const nodes = useStore((s) => s.nodes);
  const traffic = useStore((s) => s.traffic);
  const region = useStore((s) => s.region);
  const setGroupCollapsed = useStore((s) => s.setGroupCollapsed);
  const members = useMemo(
    () => nodes.filter((n) => n.group === data.groupId),
    [nodes, data.groupId],
  );
  const sum = useMemo(() => {
    try {
      const s = useStore.getState();
      const costs = new Map(
        allCosts(snapshotOf(s), pricingOf(s)).map((c) => [c.nodeId, c.monthly]),
      );
      return members.reduce((a, n) => a + (costs.get(n.id) ?? 0), 0);
    } catch {
      return 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, traffic, region]);

  if (!group) return null;
  const icons = members
    .map((m) => getService(m.service)?.icon)
    .filter(Boolean)
    .slice(0, 4) as string[];

  return (
    <div className="overhead-node relative" style={{ width: 200, height: NODE_H }}>
      <Handle type="target" position={Position.Left} style={{ top: NODE_H / 2 }} />
      <Handle type="source" position={Position.Right} style={{ top: NODE_H / 2 }} />
      <div
        className="absolute cursor-pointer rounded-lg border-2 bg-surface shadow-sm"
        style={{
          left: 0,
          top: (NODE_H - 76) / 2,
          width: 200,
          height: 76,
          borderColor: "var(--accent)",
        }}
        onDoubleClick={() => setGroupCollapsed(group.id, false)}
        title="Double-click to expand"
      >
        <div className="absolute left-3 top-3 grid grid-cols-2 gap-0.5">
          {icons.map((ic, i) => (
            <svg key={i} width="22" height="22">
              <use href={`#${ic}`} width="22" height="22" />
            </svg>
          ))}
        </div>
        <div className="absolute left-[70px] right-2 top-[10px]">
          <div
            className="truncate text-[9.5px] font-semibold uppercase opacity-65"
            style={{ fontFamily: "var(--font-archivo)" }}
          >
            {group.kind === "logical" ? "Group" : group.kind}
          </div>
          <div className="truncate text-[12.5px] font-medium leading-4">
            {group.name}
          </div>
          <div
            className="truncate text-[9.5px] opacity-70"
            style={{ fontFamily: "var(--font-plex-mono)" }}
          >
            {members.length} resources
          </div>
        </div>
        <div
          className="absolute bottom-1.5 right-2.5 text-[11px] font-semibold"
          style={{ fontFamily: "var(--font-plex-mono)" }}
        >
          ${toMoney(sum).toFixed(2)}
        </div>
      </div>
    </div>
  );
});
