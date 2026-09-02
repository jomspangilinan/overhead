"use client";

// Container frames, painted parents-first so children sit above. Bounds are
// the union of what's inside and what the user stored (engine/frames.ts):
// a hand-placed frame keeps its position and never clips a member. The
// chrome and the drag/resize gesture are shared with sections
// (frames/FrameChrome, frames/useFrameGesture).

import { useMemo } from "react";
import { ViewportPortal } from "@xyflow/react";
import { useStore, pricingOf, snapshotOf } from "@/store/useStore";
import { KIND_META, containerStats, descendantIds, type Container } from "@/engine/containers";
import { frameBoxes, depthOf, type Box } from "@/engine/frames";
import { formatCost } from "@/engine/model";
import { NODE_W, NODE_H } from "./nodeMetrics";
import { FrameChrome } from "./frames/FrameChrome";
import { useFrameGesture } from "./frames/useFrameGesture";

export function ContainerFrames() {
  const nodes = useStore((s) => s.nodes);
  const containers = useStore((s) => s.containers);
  const costOn = useStore((s) => s.layers.cost);
  const costDisplay = useStore((s) => s.costDisplay);
  const traffic = useStore((s) => s.traffic);
  const region = useStore((s) => s.region);
  const draggingId = useStore((s) => s.draggingId);
  const frameDrag = useStore((s) => s.frameDrag);
  const selectedId = useStore((s) => s.selectedId);
  const setContainerBounds = useStore((s) => s.setContainerBounds);
  const setContainerCollapsed = useStore((s) => s.setContainerCollapsed);
  const renameContainer = useStore((s) => s.renameContainer);
  const select = useStore((s) => s.select);
  const gesture = useFrameGesture("container", setContainerBounds);

  const stats = useMemo(() => {
    try {
      const s = useStore.getState();
      return containerStats(snapshotOf(s), pricingOf(s));
    } catch {
      return new Map();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, containers, traffic, region]);

  // Boxes as drawn. A node mid-drag is left out so its frame stays put; a
  // frame mid-drag (and its subtree) is shifted by the pending offset.
  const boxes = useMemo(() => {
    const out = frameBoxes(nodes, containers, { nodeW: NODE_W, nodeH: NODE_H, exclude: draggingId });
    if (frameDrag && frameDrag.kind === "container") {
      const ids = new Set([frameDrag.id, ...descendantIds(containers, frameDrag.id)]);
      for (const id of ids) {
        const b = out.get(id);
        if (b) out.set(id, { l: b.l + frameDrag.dx, t: b.t + frameDrag.dy, r: b.r + frameDrag.dx, b: b.b + frameDrag.dy });
      }
    }
    if (gesture.resize) out.set(gesture.resize.id, gesture.resize.box);
    return out;
  }, [nodes, containers, draggingId, frameDrag, gesture.resize]);

  // parents first, so a child paints over its parent
  const ordered = useMemo(
    () => [...containers].sort((a, b) => depthOf(containers, a) - depthOf(containers, b)),
    [containers],
  );

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
        const box: Box | undefined = boxes.get(c.id);
        if (!box) return null;
        const meta = KIND_META[c.kind];
        const stat = stats.get(c.id);
        return (
          <FrameChrome
            key={c.id}
            id={c.id}
            box={box}
            color={meta.color}
            dash={meta.dash ? "dashed" : "solid"}
            borderWidth={1.3}
            fill
            radius={10}
            selected={selectedId === c.id}
            icon={meta.icon ?? undefined}
            kindLabel={meta.label}
            name={c.name}
            detail={c.cidr}
            detailHint="name · cidr"
            stat={costOn && costDisplay.containers && stat ? `${stat.resources} · ${formatCost(stat.monthly, costDisplay)}` : undefined}
            collapseTitle={`Collapse ${c.name} to a card`}
            onCollapse={() => setContainerCollapsed(c.id, true)}
            onSelect={() => select(c.id)}
            onRename={(name, cidr) => renameContainer(c.id, name, cidr ?? "")}
            begin={gesture.begin}
            move={gesture.move}
            end={gesture.end}
            moveTitle={`Drag to move ${c.name} with everything in it`}
          />
        );
      })}
    </ViewportPortal>
  );
}
