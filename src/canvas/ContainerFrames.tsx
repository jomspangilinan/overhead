"use client";

// Container frames, painted parents-first so children sit above. Bounds are
// the union of what's inside and what the user stored (engine/frames.ts) —
// so an agent-built architecture looks right with no extra tool arguments,
// and a hand-placed frame keeps its position and never clips a member.
//
// Direct manipulation: the header band drags the frame and everything in
// it (one undo step, committed on release); the corner grip resizes down to
// the content floor; click selects; double-click the name renames.

import { useMemo, useRef, useState } from "react";
import { ViewportPortal } from "@xyflow/react";
import { useStore, pricingOf, snapshotOf } from "@/store/useStore";
import { KIND_META, containerStats, descendantIds, type Container } from "@/engine/containers";
import { frameBoxes, depthOf, toBounds, type Box } from "@/engine/frames";
import { NODE_W, NODE_H } from "./nodeMetrics";

const HEAD_H = 34;

export function ContainerFrames() {
  const nodes = useStore((s) => s.nodes);
  const containers = useStore((s) => s.containers);
  const costOn = useStore((s) => s.layers.cost);
  const traffic = useStore((s) => s.traffic);
  const region = useStore((s) => s.region);
  const zoom = useStore((s) => s.zoom);
  const draggingId = useStore((s) => s.draggingId);
  const frameDrag = useStore((s) => s.frameDrag);
  const selectedId = useStore((s) => s.selectedId);
  const select = useStore((s) => s.select);
  const setFrameDrag = useStore((s) => s.setFrameDrag);
  const moveContainer = useStore((s) => s.moveContainer);
  const setContainerBounds = useStore((s) => s.setContainerBounds);
  const setContainerCollapsed = useStore((s) => s.setContainerCollapsed);
  const renameContainer = useStore((s) => s.renameContainer);
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
        if (b)
          out.set(id, {
            l: b.l + frameDrag.dx,
            t: b.t + frameDrag.dy,
            r: b.r + frameDrag.dx,
            b: b.b + frameDrag.dy,
          });
      }
    }
    if (resize) out.set(resize.id, resize.box);
    return out;
  }, [nodes, containers, draggingId, frameDrag, resize]);

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

  const begin = (e: React.PointerEvent, c: Container, mode: "move" | "resize", box: Box) => {
    if (editing === c.id) return;
    e.stopPropagation();
    e.preventDefault();
    gesture.current = { id: c.id, mode, x: e.clientX, y: e.clientY, box, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const move = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    const dx = (e.clientX - g.x) / zoom;
    const dy = (e.clientY - g.y) / zoom;
    if (!g.moved && Math.abs(dx) + Math.abs(dy) < 2) return;
    g.moved = true;
    if (g.mode === "move") {
      setFrameDrag({ kind: "container", id: g.id, dx, dy });
    } else {
      setResize({
        id: g.id,
        box: { l: g.box.l, t: g.box.t, r: Math.max(g.box.l + 120, g.box.r + dx), b: Math.max(g.box.t + 80, g.box.b + dy) },
      });
    }
  };

  const end = (e: React.PointerEvent) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    const dx = (e.clientX - g.x) / zoom;
    const dy = (e.clientY - g.y) / zoom;
    if (g.mode === "move") {
      setFrameDrag(null);
      if (g.moved) moveContainer(g.id, dx, dy);
      else select(g.id);
    } else {
      setResize(null);
      if (g.moved)
        setContainerBounds(
          g.id,
          toBounds({ l: g.box.l, t: g.box.t, r: Math.max(g.box.l + 120, g.box.r + dx), b: Math.max(g.box.t + 80, g.box.b + dy) }),
        );
    }
  };

  return (
    <ViewportPortal>
      {ordered.map((c) => {
        if (c.collapsed || hidden(c)) return null;
        const box = boxes.get(c.id);
        if (!box) return null;
        const meta = KIND_META[c.kind];
        const stat = stats.get(c.id);
        const selected = selectedId === c.id;
        const labelLeft = box.l + (meta.icon ? 37 : 12);
        return (
          <div key={c.id}>
            <div
              className="pointer-events-none absolute rounded-lg"
              style={{
                left: box.l,
                top: box.t,
                width: box.r - box.l,
                height: box.b - box.t,
                border: `${selected ? 1.8 : 1.3}px ${meta.dash ? "dashed" : "solid"} ${selected ? "var(--accent)" : meta.color}`,
                background: `color-mix(in srgb, ${meta.color} 4.5%, transparent)`,
                boxShadow: selected ? "0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent)" : undefined,
              }}
            />
            {/* header band: the drag handle */}
            <div
              className="oh-frame-head nopan nodrag absolute rounded-t-lg"
              style={{ left: box.l, top: box.t, width: box.r - box.l, height: HEAD_H }}
              title={`${meta.label} — drag to move with its contents · click to select`}
              onPointerDown={(e) => begin(e, c, "move", box)}
              onPointerMove={move}
              onPointerUp={end}
              onPointerCancel={end}
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
              style={{ left: labelLeft, top: box.t + 8, letterSpacing: "0.9px", color: meta.color, opacity: 0.85 }}
            >
              {meta.label}
            </div>
            {editing === c.id ? (
              <input
                autoFocus
                defaultValue={c.cidr ? `${c.name} · ${c.cidr}` : c.name}
                className="oh-frame-input nodrag nopan absolute rounded bg-panel-2 px-1 text-[11.5px] font-medium outline-none"
                style={{ left: labelLeft, top: box.t + 17, width: 220, border: "1px solid var(--accent)", color: "var(--ink-15)" }}
                title="name · cidr"
                onBlur={(e) => {
                  const [name, cidr] = e.target.value.split("·").map((x) => x.trim());
                  renameContainer(c.id, name ?? c.name, cidr ?? "");
                  setEditing(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  if (e.key === "Escape") setEditing(null);
                }}
                onPointerDown={(e) => e.stopPropagation()}
              />
            ) : (
              <div
                className="oh-frame-name nopan nodrag absolute cursor-text select-none whitespace-nowrap text-[11.5px] font-medium"
                style={{ left: labelLeft, top: box.t + 19, color: "var(--ink-15)" }}
                title="Double-click to rename (name · cidr)"
                onPointerDown={(e) => begin(e, c, "move", box)}
                onPointerMove={move}
                onPointerUp={end}
                onPointerCancel={end}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setEditing(c.id);
                }}
              >
                {c.cidr ? `${c.name} · ${c.cidr}` : c.name}
              </div>
            )}
            {/* move grip: the frame's own handle, so nobody has to guess */}
            <div
              className="oh-frame-move nopan nodrag absolute grid place-items-center rounded-md"
              style={{
                left: box.r - 30,
                top: box.t + 7,
                width: 22,
                height: 20,
                background: selected ? "var(--accent-bg)" : "var(--panel)",
                border: `1px solid ${selected ? "var(--accent)" : meta.color}`,
                color: selected ? "var(--accent-ink)" : meta.color,
              }}
              title={`Drag to move ${c.name} with everything in it`}
              onPointerDown={(e) => begin(e, c, "move", box)}
              onPointerMove={move}
              onPointerUp={end}
              onPointerCancel={end}
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 1.5v13M1.5 8h13M8 1.5 6 3.5M8 1.5l2 2M8 14.5l-2-2M8 14.5l2-2M1.5 8l2-2M1.5 8l2 2M14.5 8l-2-2M14.5 8l-2 2" />
              </svg>
            </div>
            {costOn && stat ? (
              <div
                className="pointer-events-none absolute select-none whitespace-nowrap text-[10px] font-semibold"
                style={{
                  left: box.l,
                  width: box.r - box.l - 40,
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
              className="oh-collapse nopan nodrag absolute text-[12px] leading-none"
              style={{ left: box.r - 36, top: box.b - 18, color: "var(--ink-4)" }}
              title={`Collapse ${c.name}`}
              onClick={() => setContainerCollapsed(c.id, true)}
            >
              ⤡
            </button>
            {/* corner grip: resize, floored at the content */}
            <div
              className="oh-frame-grip nopan nodrag absolute"
              style={{ left: box.r - 14, top: box.b - 14, width: 14, height: 14 }}
              title="Drag to resize — never smaller than what's inside"
              onPointerDown={(e) => begin(e, c, "resize", box)}
              onPointerMove={move}
              onPointerUp={end}
              onPointerCancel={end}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" stroke={meta.color} strokeWidth="1.2" fill="none">
                <path d="M13 5 5 13M13 9l-4 4" />
              </svg>
            </div>
          </div>
        );
      })}
    </ViewportPortal>
  );
}
