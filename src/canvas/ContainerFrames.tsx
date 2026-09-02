"use client";

// Container frames, painted parents-first so children sit above. Bounds are
// derived from what's inside (union of member nodes and child frames) unless
// the user has stored them — so an agent-built architecture looks right with
// no extra tool arguments.

import { useMemo } from "react";
import { ViewportPortal } from "@xyflow/react";
import { useStore, pricingOf, snapshotOf } from "@/store/useStore";
import {
  KIND_META,
  containerStats,
  type Container,
} from "@/engine/containers";
import { NODE_W, NODE_H } from "./AwsNode";

interface Box {
  l: number;
  t: number;
  r: number;
  b: number;
}

/** Padding per kind so nested frames don't touch. */
const PAD: Record<string, number> = {
  cloud: 46,
  region: 34,
  vpc: 28,
  subnetpub: 22,
  subnetpri: 22,
};

export function ContainerFrames() {
  const nodes = useStore((s) => s.nodes);
  const containers = useStore((s) => s.containers);
  const costOn = useStore((s) => s.layers.cost);
  const traffic = useStore((s) => s.traffic);
  const region = useStore((s) => s.region);
  const setContainerCollapsed = useStore((s) => s.setContainerCollapsed);

  const stats = useMemo(() => {
    try {
      const s = useStore.getState();
      return containerStats(snapshotOf(s), pricingOf(s));
    } catch {
      return new Map();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, containers, traffic, region]);

  // Bounds bottom-up: a frame wraps its own nodes and every child frame.
  const boxes = useMemo(() => {
    const out = new Map<string, Box>();
    const compute = (c: Container): Box | null => {
      if (out.has(c.id)) return out.get(c.id)!;
      if (c.bounds) {
        const b = {
          l: c.bounds.x,
          t: c.bounds.y,
          r: c.bounds.x + c.bounds.w,
          b: c.bounds.y + c.bounds.h,
        };
        out.set(c.id, b);
        return b;
      }
      const parts: Box[] = [];
      for (const n of nodes) {
        if (n.container !== c.id) continue;
        parts.push({
          l: n.position.x - NODE_W / 2,
          t: n.position.y - NODE_H / 2,
          r: n.position.x + NODE_W / 2,
          b: n.position.y + NODE_H / 2,
        });
      }
      for (const child of containers) {
        if (child.parent !== c.id || child.id === c.id) continue;
        const cb = compute(child);
        if (cb) parts.push(cb);
      }
      if (!parts.length) return null;
      const pad = PAD[c.kind] ?? 24;
      const box = {
        l: Math.min(...parts.map((p) => p.l)) - pad,
        t: Math.min(...parts.map((p) => p.t)) - pad - 14,
        r: Math.max(...parts.map((p) => p.r)) + pad,
        b: Math.max(...parts.map((p) => p.b)) + pad,
      };
      out.set(c.id, box);
      return box;
    };
    for (const c of containers) compute(c);
    return out;
  }, [nodes, containers]);

  // parents first, so a child paints over its parent
  const ordered = useMemo(() => {
    const depth = (c: Container): number => {
      let d = 0;
      let p = c.parent;
      for (let i = 0; p && i < 12; i++) {
        d++;
        p = containers.find((x) => x.id === p)?.parent;
      }
      return d;
    };
    return [...containers].sort((a, b) => depth(a) - depth(b));
  }, [containers]);

  const hidden = (c: Container): boolean => {
    let p = c.parent;
    for (let i = 0; p && i < 12; i++) {
      const parent = containers.find((x) => x.id === p);
      if (parent?.collapsed) return true;
      p = parent?.parent;
    }
    return false;
  };

  return (
    <ViewportPortal>
      {ordered.map((c) => {
        if (c.collapsed || hidden(c)) return null;
        const box = boxes.get(c.id);
        if (!box) return null;
        const meta = KIND_META[c.kind];
        const stat = stats.get(c.id);
        return (
          <div key={c.id}>
            <div
              className="pointer-events-none absolute rounded-lg"
              style={{
                left: box.l,
                top: box.t,
                width: box.r - box.l,
                height: box.b - box.t,
                border: `1.3px ${meta.dash ? "dashed" : "solid"} ${meta.color}`,
                background: `color-mix(in srgb, ${meta.color} 4.5%, transparent)`,
              }}
            />
            {meta.icon ? (
              <svg
                className="pointer-events-none absolute"
                style={{ left: box.l + 7, top: box.t + 7 }}
                width="24"
                height="24"
              >
                <use href={`#${meta.icon}`} width="24" height="24" />
              </svg>
            ) : null}
            <div
              className="pointer-events-none absolute select-none whitespace-nowrap text-[8.5px] font-semibold uppercase"
              style={{
                left: box.l + (meta.icon ? 37 : 12),
                top: box.t + 8,
                letterSpacing: "0.9px",
                color: meta.color,
                opacity: 0.85,
              }}
            >
              {meta.label}
            </div>
            <div
              className="pointer-events-none absolute select-none whitespace-nowrap text-[11.5px] font-medium"
              style={{
                left: box.l + (meta.icon ? 37 : 12),
                top: box.t + 19,
                color: "var(--ink-15)",
              }}
            >
              {c.cidr ? `${c.name} · ${c.cidr}` : c.name}
            </div>
            {costOn && stat ? (
              <div
                className="pointer-events-none absolute select-none whitespace-nowrap text-[10px] font-semibold"
                style={{
                  left: box.l,
                  width: box.r - box.l - 10,
                  top: box.t + 13,
                  textAlign: "right",
                  color: meta.color,
                  fontFamily: "var(--font-mono-jb)",
                }}
              >
                {stat.resources} · ${stat.monthly.toFixed(2)}/mo
              </div>
            ) : null}
            <button
              className="oh-collapse absolute text-[12px] leading-none"
              style={{
                left: box.r - 20,
                top: box.b - 18,
                color: "var(--ink-4)",
              }}
              title={`Collapse ${c.name}`}
              onClick={() => setContainerCollapsed(c.id, true)}
            >
              ⤡
            </button>
          </div>
        );
      })}
    </ViewportPortal>
  );
}
