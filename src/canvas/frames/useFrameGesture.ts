"use client";

// The one pointer gesture every frame uses (containers and sections alike):
// press on the header band or move grip and drag to move (a preview through
// store.frameDrag, committed once on release so undo sees one step), press
// the corner grip to resize (local preview, committed once), a press that
// never moves selects.

import { useRef, useState } from "react";
import { useStore } from "@/store/useStore";
import type { Box, Bounds, FrameRef } from "@/engine/frames";

export const MIN_W = 120;
export const MIN_H = 80;

export function useFrameGesture(kind: FrameRef["kind"], commitResize: (id: string, bounds: Bounds) => void) {
  const zoom = useStore((s) => s.zoom);
  const setFrameDrag = useStore((s) => s.setFrameDrag);
  const moveContainer = useStore((s) => s.moveContainer);
  const moveSection = useStore((s) => s.moveSection);
  const select = useStore((s) => s.select);
  const [resize, setResize] = useState<{ id: string; box: Box } | null>(null);
  const gesture = useRef<{ id: string; mode: "move" | "resize"; x: number; y: number; box: Box; moved: boolean } | null>(null);
  const commitMove = kind === "container" ? moveContainer : moveSection;

  const resized = (g: NonNullable<typeof gesture.current>, dx: number, dy: number): Box => ({
    l: g.box.l,
    t: g.box.t,
    r: Math.max(g.box.l + MIN_W, g.box.r + dx),
    b: Math.max(g.box.t + MIN_H, g.box.b + dy),
  });

  const begin = (e: React.PointerEvent, id: string, mode: "move" | "resize", box: Box) => {
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
    if (g.mode === "move") setFrameDrag({ kind, id: g.id, dx, dy });
    else setResize({ id: g.id, box: resized(g, dx, dy) });
  };

  const end = (e: React.PointerEvent) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    const dx = (e.clientX - g.x) / zoom;
    const dy = (e.clientY - g.y) / zoom;
    if (g.mode === "move") {
      setFrameDrag(null);
      if (g.moved) commitMove(g.id, dx, dy);
      else select(g.id);
    } else {
      setResize(null);
      if (g.moved) {
        const b = resized(g, dx, dy);
        commitResize(g.id, { x: Math.round(b.l), y: Math.round(b.t), w: Math.round(b.r - b.l), h: Math.round(b.b - b.t) });
      }
    }
  };

  const cancel = () => {
    gesture.current = null;
    setFrameDrag(null);
    setResize(null);
  };

  return { begin, move, end, cancel, resize };
}
