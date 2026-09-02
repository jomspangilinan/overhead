"use client";

// Group frames in graph coordinates: the AWS Cloud frame around everything,
// and each expanded logical/network group around its members, with the
// official colour, corner icon, and a member-count + subtotal readout.

import { ViewportPortal } from "@xyflow/react";
import { useStore, pricingOf, snapshotOf } from "@/store/useStore";
import { allCosts } from "@/engine/cost";
import { toMoney, type ArchGroup } from "@/engine/model";
import { NODE_W, NODE_H } from "./AwsNode";

const GROUP_STYLE: Record<ArchGroup["kind"], { color: string; icon: string }> = {
  cloud: { color: "#242F3E", icon: "aws-group-cloud" },
  vpc: { color: "#8C4FFF", icon: "aws-group-vpc" },
  subnet: { color: "#7AA116", icon: "aws-group-public" },
  az: { color: "#00A4A6", icon: "aws-group-private" },
  logical: { color: "var(--accent)", icon: "aws-group-cloud" },
};

interface Box {
  l: number;
  t: number;
  r: number;
  b: number;
}

function boxAround(positions: { x: number; y: number }[], pad: number): Box | null {
  if (!positions.length) return null;
  return {
    l: Math.min(...positions.map((p) => p.x - NODE_W / 2)) - pad,
    t: Math.min(...positions.map((p) => p.y - NODE_H / 2)) - pad - 14,
    r: Math.max(...positions.map((p) => p.x + NODE_W / 2)) + pad,
    b: Math.max(...positions.map((p) => p.y + NODE_H / 2)) + pad,
  };
}

function Frame({
  box,
  color,
  icon,
  label,
  sub,
  dashed,
}: {
  box: Box;
  color: string;
  icon: string;
  label: string;
  sub?: string;
  dashed?: boolean;
}) {
  return (
    <>
      <div
        className="pointer-events-none absolute rounded"
        style={{
          left: box.l,
          top: box.t,
          width: box.r - box.l,
          height: box.b - box.t,
          border: `1.4px ${dashed ? "dashed" : "solid"} ${color}`,
          background: `color-mix(in srgb, ${color} 3.5%, transparent)`,
        }}
      />
      <svg
        className="pointer-events-none absolute"
        style={{ left: box.l, top: box.t }}
        width="26"
        height="26"
      >
        <use href={`#${icon}`} width="26" height="26" />
      </svg>
      <div
        className="pointer-events-none absolute text-[12px] font-medium"
        style={{ left: box.l + 32, top: box.t + 4, color: "var(--ink)" }}
      >
        {label}
      </div>
      {sub ? (
        <div
          className="pointer-events-none absolute text-[10.5px] font-semibold"
          style={{
            right: undefined,
            left: box.l,
            top: box.t + 4,
            width: box.r - box.l - 10,
            textAlign: "right",
            color,
            fontFamily: "var(--font-plex-mono)",
          }}
        >
          {sub}
        </div>
      ) : null}
    </>
  );
}

export function GroupFrames() {
  const nodes = useStore((s) => s.nodes);
  const groups = useStore((s) => s.groups);
  const costs = useStore((s) => {
    try {
      return new Map(
        allCosts(snapshotOf(s), pricingOf(s)).map((c) => [c.nodeId, c.monthly]),
      );
    } catch {
      return new Map<string, number>();
    }
  });

  const cloudBox = boxAround(
    nodes.map((n) => n.position),
    46,
  );

  return (
    <ViewportPortal>
      {cloudBox && nodes.length > 0 ? (
        <Frame
          box={cloudBox}
          color={GROUP_STYLE.cloud.color}
          icon={GROUP_STYLE.cloud.icon}
          label="AWS Cloud"
        />
      ) : null}
      {groups
        .filter((g) => !g.collapsed)
        .map((g) => {
          const members = nodes.filter((n) => n.group === g.id);
          const box = boxAround(
            members.map((n) => n.position),
            22,
          );
          if (!box) return null;
          const style = GROUP_STYLE[g.kind] ?? GROUP_STYLE.logical;
          const sum = members.reduce((a, n) => a + (costs.get(n.id) ?? 0), 0);
          return (
            <Frame
              key={g.id}
              box={box}
              color={style.color}
              icon={style.icon}
              label={g.cidr ? `${g.name} · ${g.cidr}` : g.name}
              sub={`${members.length} resources · $${toMoney(sum).toFixed(2)}/mo`}
              dashed={g.kind === "logical"}
            />
          );
        })}
    </ViewportPortal>
  );
}
