"use client";

// Sections: yours, free-form, orthogonal. A dashed frame with the same
// chrome containers have (header band, name, gear, move grip, resize grip)
// so both frames read and behave the same. Dragging moves its declared
// members (through nested sections) and every section riding along, never
// whatever happens to sit inside the box. Groups draw nothing.

import { useMemo } from "react";
import { ViewportPortal } from "@xyflow/react";
import { useStore } from "@/store/useStore";
import { sectionBoxes, movedSectionIds, type Box } from "@/engine/frames";
import { outermostCollapsedAncestor } from "@/engine/containers";
import { NODE_W, NODE_H } from "./nodeMetrics";
import { FrameChrome } from "./frames/FrameChrome";
import { useFrameGesture } from "./frames/useFrameGesture";

export function SectionFrames() {
  const sections = useStore((s) => s.sections);
  const nodes = useStore((s) => s.nodes);
  const containers = useStore((s) => s.containers);
  const on = useStore((s) => s.layers.sections);
  const draggingId = useStore((s) => s.draggingId);
  const frameDrag = useStore((s) => s.frameDrag);
  const selectedId = useStore((s) => s.selectedId);
  const setSectionBounds = useStore((s) => s.setSectionBounds);
  const renameSection = useStore((s) => s.renameSection);
  const setSectionCollapsed = useStore((s) => s.setSectionCollapsed);
  const select = useStore((s) => s.select);
  const gesture = useFrameGesture("section", setSectionBounds);

  // Members hidden inside a collapsed container leave the section's box;
  // a section whose every member is hidden is not drawn at all (it folds
  // with the container it is in).
  const hidden = useMemo(() => {
    const out = new Set(nodes.filter((n) => outermostCollapsedAncestor(containers, n.container)).map((n) => n.id));
    for (const s of sections) if (s.collapsed && s.kind !== "group") for (const id of s.nodeIds) out.add(id);
    return out;
  }, [nodes, containers, sections]);

  // Boxes as drawn; a frame mid-drag shifts every section riding along
  // (the dragged section's tree, or sections wholly inside a dragged
  // container), so the preview matches what the commit will do.
  const boxes = useMemo(() => {
    const out = sectionBoxes(nodes, sections, { nodeW: NODE_W, nodeH: NODE_H, exclude: draggingId, hidden });
    if (frameDrag) {
      for (const id of movedSectionIds({ nodes, containers, sections }, frameDrag)) {
        const b = out.get(id);
        if (b) out.set(id, { l: b.l + frameDrag.dx, t: b.t + frameDrag.dy, r: b.r + frameDrag.dx, b: b.b + frameDrag.dy });
      }
    }
    if (gesture.resize) out.set(gesture.resize.id, gesture.resize.box);
    return out;
  }, [sections, nodes, containers, draggingId, frameDrag, gesture.resize, hidden]);

  if (!on) return null;

  return (
    <ViewportPortal>
      {sections.map((s) => {
        // a collapsed section draws a card (Canvas) instead of a frame
        if (s.kind === "group" || s.collapsed) return null;
        const box: Box | undefined = boxes.get(s.id);
        if (!box) return null;
        return (
          <FrameChrome
            key={s.id}
            id={s.id}
            box={box}
            color={s.color}
            dash={s.style?.dash ?? "dashed"}
            borderWidth={s.style?.width ?? 1.4}
            fill={s.style?.fill ?? true}
            radius={12}
            selected={selectedId === s.id}
            kindLabel={`Section · ${s.nodeIds.length}`}
            name={s.name}
            collapseTitle={`Collapse ${s.name} to a card`}
            onCollapse={() => setSectionCollapsed(s.id, true)}
            onSelect={() => select(s.id)}
            onRename={(name) => renameSection(s.id, name)}
            begin={gesture.begin}
            move={gesture.move}
            end={gesture.end}
            moveTitle={`Drag to move ${s.name} and everything in it`}
          />
        );
      })}
    </ViewportPortal>
  );
}
