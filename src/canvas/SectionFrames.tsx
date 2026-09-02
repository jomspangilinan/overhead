"use client";

// Sections: yours, free-form, orthogonal. Dotted frame with a label chip
// above it, drawn above containers and below nodes. Dragging one moves its
// declared members — never whatever happens to be inside the box, which
// would silently steal nodes.

import { useMemo, useRef, useState } from "react";
import { ViewportPortal } from "@xyflow/react";
import { useStore } from "@/store/useStore";
import { NODE_W, NODE_H } from "./AwsNode";

export function SectionFrames() {
  const sections = useStore((s) => s.sections);
  const nodes = useStore((s) => s.nodes);
  const on = useStore((s) => s.layers.sections);
  const moveSection = useStore((s) => s.moveSection);
  const renameSection = useStore((s) => s.renameSection);
  const zoom = useStore((s) => s.zoom);
  const drag = useRef<{ id: string; x: number; y: number } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  // A section without stored bounds wraps its members.
  const boxes = useMemo(() => {
    const out = new Map<string, { l: number; t: number; r: number; b: number }>();
    for (const s of sections) {
      if (s.bounds) {
        out.set(s.id, {
          l: s.bounds.x,
          t: s.bounds.y,
          r: s.bounds.x + s.bounds.w,
          b: s.bounds.y + s.bounds.h,
        });
        continue;
      }
      const members = nodes.filter((n) => s.nodeIds.includes(n.id));
      if (!members.length) continue;
      const pad = 26;
      out.set(s.id, {
        l: Math.min(...members.map((n) => n.position.x - NODE_W / 2)) - pad,
        t: Math.min(...members.map((n) => n.position.y - NODE_H / 2)) - pad,
        r: Math.max(...members.map((n) => n.position.x + NODE_W / 2)) + pad,
        b: Math.max(...members.map((n) => n.position.y + NODE_H / 2)) + pad,
      });
    }
    return out;
  }, [sections, nodes]);

  if (!on) return null;

  return (
    <ViewportPortal>
      {sections.map((s) => {
        const box = boxes.get(s.id);
        if (!box) return null;
        const w = box.r - box.l;
        return (
          <div key={s.id}>
            <div
              className="absolute rounded-xl"
              style={{
                left: box.l,
                top: box.t,
                width: w,
                height: box.b - box.t,
                border: `1.4px dashed ${s.color}`,
                borderRadius: 12,
                background: `color-mix(in srgb, ${s.color} 5%, transparent)`,
                pointerEvents: "none",
              }}
            />
            <div
              className="absolute flex cursor-grab items-center gap-2 rounded-md px-2.5 text-[10.5px] font-semibold"
              style={{
                left: box.l,
                top: box.t - 23,
                height: 20,
                background: `color-mix(in srgb, ${s.color} 16%, transparent)`,
                border: `1px solid ${s.color}`,
                color: s.color,
              }}
              onPointerDown={(e) => {
                if (editing === s.id) return;
                drag.current = { id: s.id, x: e.clientX, y: e.clientY };
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                const d = drag.current;
                if (!d || d.id !== s.id) return;
                const dx = (e.clientX - d.x) / zoom;
                const dy = (e.clientY - d.y) / zoom;
                if (Math.abs(dx) + Math.abs(dy) < 1) return;
                drag.current = { id: s.id, x: e.clientX, y: e.clientY };
                moveSection(s.id, dx, dy);
              }}
              onPointerUp={() => {
                drag.current = null;
              }}
              onDoubleClick={() => setEditing(s.id)}
              title="Drag to move the section and everything in it · double-click to rename"
            >
              {editing === s.id ? (
                <input
                  autoFocus
                  defaultValue={s.name}
                  className="bg-transparent outline-none"
                  style={{ color: s.color, width: Math.max(60, s.name.length * 7) }}
                  onBlur={(e) => {
                    renameSection(s.id, e.target.value.trim() || s.name);
                    setEditing(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    if (e.key === "Escape") setEditing(null);
                  }}
                />
              ) : (
                <>
                  {s.name}
                  <span style={{ opacity: 0.7 }}>{s.nodeIds.length}</span>
                </>
              )}
            </div>
          </div>
        );
      })}
    </ViewportPortal>
  );
}
