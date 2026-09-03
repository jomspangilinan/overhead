"use client";

// The request, travelling.
//
// A traced path used to light up all at once and march its dashes, which
// reads as "these are highlighted" rather than "this is what happens". A
// single dot running the route reads as the request itself · and when there
// is more than one route it takes them **one at a time**, first to its end,
// then the next, because five branches pulsing together is a light show and
// tells you nothing about which way anything went.
//
// It reads the geometry off the **rendered** edge, not a second copy of it:
// React Flow puts the edge id on its `<path>`, so `getPointAtLength` gives a
// point that already includes the waypoints, the anchor sides and the shape
// the user picked. Duplicating `edgeGeometry` here would be a second
// implementation to keep in step (and the first thing to drift the moment
// somebody drags a bend).

import { useEffect, useRef, useState } from "react";
import { ViewportPortal } from "@xyflow/react";
import { useStore } from "@/store/useStore";
import { traceFrom } from "@/engine/trace";

/** Flow units a second · fast enough to feel like a request, slow enough to
 *  follow with your eye across a wide drawing. */
const SPEED = 420;
/** A beat at the end of each branch, so the eye registers where it stopped
 *  before the next one starts. */
const PAUSE_MS = 320;
const RADIUS = 5;

export function TracePulse() {
  const traceIds = useStore((s) => s.traceIds);
  const edges = useStore((s) => s.edges);
  const tracePlay = useStore((s) => s.tracePlay);
  const setTraceBranch = useStore((s) => s.setTraceBranch);
  const origin = traceIds?.[0];

  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const frame = useRef<number>(0);

  useEffect(() => {
    setAt(null);
    if (!origin) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const { branches } = traceFrom(edges, origin);
    if (!branches.length) return;

    let branch = 0;
    let along = 0;
    let waitUntil = 0;
    let last = performance.now();
    setTraceBranch(0);

    /** The rendered path for an edge id · null while React Flow has not
     *  drawn it yet (the first frame after a trace), which is a skip, not an
     *  error. */
    const pathOf = (id: string) =>
      document.getElementById(id) as SVGPathElement | null;

    const tick = (now: number) => {
      frame.current = requestAnimationFrame(tick);
      const dt = Math.min(now - last, 100) / 1000;
      last = now;
      if (now < waitUntil) return;

      const route = branches[branch % branches.length];
      // Walk the route as one continuous length, so a dot crossing from one
      // connection to the next does not stall at the join.
      let remaining = (along += SPEED * dt);
      for (const id of route) {
        const path = pathOf(id);
        if (!path) continue;
        const len = path.getTotalLength();
        if (remaining <= len) {
          const p = path.getPointAtLength(remaining);
          setAt({ x: p.x, y: p.y });
          return;
        }
        remaining -= len;
      }
      // Ran off the end of this branch · hold, then take the next one.
      // The index goes to the store because the *lighting* follows the pulse
      // in branch mode: one route lit at a time is the whole point, and a
      // 26-resource trace lighting all at once says "these are highlighted"
      // rather than "this is what happens".
      branch += 1;
      along = 0;
      waitUntil = now + PAUSE_MS;
      setAt(null);
      setTraceBranch(branch % branches.length);
    };

    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin, edges, tracePlay]);

  if (!at) return null;
  return (
    <ViewportPortal>
      <div
        className="oh-trace-pulse"
        style={{
          position: "absolute",
          transform: `translate(${at.x - RADIUS}px, ${at.y - RADIUS}px)`,
          width: RADIUS * 2,
          height: RADIUS * 2,
          pointerEvents: "none",
          zIndex: 2,
        }}
        aria-hidden
      />
    </ViewportPortal>
  );
}
