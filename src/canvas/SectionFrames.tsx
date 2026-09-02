"use client";

// Sections: yours, free-form, orthogonal. Dotted frame with a label chip
// above it, drawn above containers and below nodes. Dragging the chip moves
// its declared members · never whatever happens to be inside the box, which
// would silently steal nodes. The drag is a preview (store.frameDrag) and
// commits once on release, so undo sees a single step; the corner grip
// stores explicit bounds; click selects the section.

import { useMemo, useRef, useState } from "react";
import { ViewportPortal } from "@xyflow/react";
import { useStore } from "@/store/useStore";
import { NODE_W, NODE_H } from "./nodeMetrics";

type Box = { l: number; t: number; r: number; b: number };
const PAD = 26;

export function SectionFrames() {
  const sections = useStore((s) => s.sections);
  const nodes = useStore((s) => s.nodes);
  const on = useStore((s) => s.layers.sections);
  const zoom = useStore((s) => s.zoom);
  const frameDrag = useStore((s) => s.frameDrag);
  const selectedId = useStore((s) => s.selectedId);
  const select = useStore((s) => s.select);
  const setFrameDrag = useStore((s) => s.setFrameDrag);
  const moveSection = useStore((s) => s.moveSection);
  const setSectionBounds = useStore((s) => s.setSectionBounds);
  const renameSection = useStore((s) => s.renameSection);
  const setPopover = useStore((s) => s.setPopover);
  const [editing, setEditing] = useState<string | null>(null);
  const [resize, setResize] = useState<{ id: string; box: Box } | null>(null);
  const gesture = useRef<{
    id: string;
    mode: "move" | "resize";
    x: number;
    y: number;
    box: Box;
    moved: boolean;
  } | null>(null);

  // A section without stored bounds wraps its members; stored bounds are a
  // floor and a position · a member outside them still grows the frame.
  const boxes = useMemo(() => {
    const out = new Map<string, Box>();
    for (const s of sections) {
      const members = nodes.filter((n) => s.nodeIds.includes(n.id));
      let box: Box | null = null;
      if (members.length) {
        box = {
          l: Math.min(...members.map((n) => n.position.x - NODE_W / 2)) - PAD,
          t: Math.min(...members.map((n) => n.position.y - NODE_H / 2)) - PAD,
          r: Math.max(...members.map((n) => n.position.x + NODE_W / 2)) + PAD,
          b: Math.max(...members.map((n) => n.position.y + NODE_H / 2)) + PAD,
        };
      }
      if (s.bounds) {
        const sb = { l: s.bounds.x, t: s.bounds.y, r: s.bounds.x + s.bounds.w, b: s.bounds.y + s.bounds.h };
        box = box
          ? { l: Math.min(box.l, sb.l), t: Math.min(box.t, sb.t), r: Math.max(box.r, sb.r), b: Math.max(box.b, sb.b) }
          : sb;
      }
      if (!box) continue;
      if (frameDrag?.kind === "section" && frameDrag.id === s.id) {
        box = { l: box.l + frameDrag.dx, t: box.t + frameDrag.dy, r: box.r + frameDrag.dx, b: box.b + frameDrag.dy };
      }
      if (resize?.id === s.id) box = resize.box;
      out.set(s.id, box);
    }
    return out;
  }, [sections, nodes, frameDrag, resize]);

  const begin = (e: React.PointerEvent, id: string, mode: "move" | "resize", box: Box) => {
    if (editing === id) return;
    e.stopPropagation();
    e.preventDefault();
    gesture.current = { id, mode, x: e.clientX, y: e.clientY, box, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const move = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    const dx = (e.clientX - g.x) / zoom;
    const dy = (e.clientY - g.y) / zoom;
    if (!g.moved && Math.abs(dx) + Math.abs(dy) < 2) return;
    g.moved = true;
    if (g.mode === "move") setFrameDrag({ kind: "section", id: g.id, dx, dy });
    else
      setResize({
        id: g.id,
        box: { l: g.box.l, t: g.box.t, r: Math.max(g.box.l + 120, g.box.r + dx), b: Math.max(g.box.t + 80, g.box.b + dy) },
      });
  };

  const end = (e: React.PointerEvent) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    const dx = (e.clientX - g.x) / zoom;
    const dy = (e.clientY - g.y) / zoom;
    if (g.mode === "move") {
      setFrameDrag(null);
      if (g.moved) moveSection(g.id, dx, dy);
      else select(g.id);
    } else {
      setResize(null);
      if (g.moved) {
        const r = Math.max(g.box.l + 120, g.box.r + dx);
        const b = Math.max(g.box.t + 80, g.box.b + dy);
        setSectionBounds(g.id, { x: Math.round(g.box.l), y: Math.round(g.box.t), w: Math.round(r - g.box.l), h: Math.round(b - g.box.t) });
      }
    }
  };

  if (!on) return null;

  return (
    <ViewportPortal>
      {sections.map((s) => {
        if (s.kind === "group") return null;
        const box = boxes.get(s.id);
        if (!box) return null;
        const w = box.r - box.l;
        const selected = selectedId === s.id;
        const dash = s.style?.dash ?? "dashed";
        const bw = s.style?.width ?? 1.4;
        const fill = s.style?.fill ?? true;
        return (
          <div key={s.id}>
            <div
              className="absolute rounded-xl"
              style={{
                left: box.l,
                top: box.t,
                width: w,
                height: box.b - box.t,
                border: `${selected ? Math.max(1.8, bw) : bw}px ${dash} ${selected ? "var(--accent)" : s.color}`,
                borderRadius: 12,
                background: fill ? `color-mix(in srgb, ${s.color} 5%, transparent)` : "transparent",
                boxShadow: selected ? "0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent)" : undefined,
                pointerEvents: "none",
              }}
            />
            <div
              className="oh-section-chip nopan nodrag absolute flex items-center gap-2 rounded-md px-2.5 text-[10.5px] font-semibold"
              style={{
                left: box.l,
                top: box.t - 23,
                height: 20,
                background: `color-mix(in srgb, ${s.color} 16%, transparent)`,
                border: `1px solid ${selected ? "var(--accent)" : s.color}`,
                color: s.color,
              }}
              onPointerDown={(e) => begin(e, s.id, "move", box)}
              onPointerMove={move}
              onPointerUp={end}
              onPointerCancel={end}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setEditing(s.id);
              }}
              title="Drag to move the section and everything in it · click to select · double-click to rename"
            >
              {editing === s.id ? (
                <input
                  autoFocus
                  defaultValue={s.name}
                  className="oh-frame-input bg-transparent outline-none"
                  style={{ color: s.color, width: Math.max(60, s.name.length * 7) }}
                  onBlur={(e) => {
                    renameSection(s.id, e.target.value.trim() || s.name);
                    setEditing(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    if (e.key === "Escape") setEditing(null);
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                />
              ) : (
                <>
                  {s.name}
                  <span style={{ opacity: 0.7 }}>{s.nodeIds.length}</span>
                  <button
                    className="oh-section-gear grid h-[14px] w-[14px] place-items-center rounded"
                    style={{ color: s.color }}
                    aria-label="Section appearance"
                    title="Appearance · colour, border, fill"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      const host = (e.currentTarget as HTMLElement).closest(".oh-main")?.getBoundingClientRect();
                      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      setPopover({ kind: "section", id: s.id, x: r.left - (host?.left ?? 0), y: r.bottom - (host?.top ?? 0) + 6 });
                    }}
                  >
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                      <circle cx="8" cy="8" r="2.4" />
                      <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" />
                    </svg>
                  </button>
                </>
              )}
            </div>
            <div
              className="oh-section-grip nopan nodrag absolute"
              style={{ left: box.r - 14, top: box.b - 14, width: 14, height: 14 }}
              title="Drag to resize · never smaller than its members"
              onPointerDown={(e) => begin(e, s.id, "resize", box)}
              onPointerMove={move}
              onPointerUp={end}
              onPointerCancel={end}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" stroke={s.color} strokeWidth="1.2" fill="none">
                <path d="M13 5 5 13M13 9l-4 4" />
              </svg>
            </div>
          </div>
        );
      })}
    </ViewportPortal>
  );
}
