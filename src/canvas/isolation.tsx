"use client";

// Which resources are lit right now, shared with the things React Flow does
// not draw.
//
// Hover isolation and trace both work by lighting a set and dimming the rest,
// and that dimming is a CSS rule on `.react-flow__node` / `.react-flow__edge`.
// Frames are not React Flow nodes · they are painted through a
// `ViewportPortal`, so no rule ever reached them and a VPC holding nothing
// relevant stayed at full strength while every resource around it faded. The
// frame looked like the answer.
//
// The set is computed once in `Canvas` (it already needs it for the nodes and
// the edges) and handed down here rather than recomputed, so the frames can
// never disagree with the resources about what is lit.

import { createContext, useContext } from "react";

const Lit = createContext<Set<string> | null>(null);

export const LitProvider = Lit.Provider;

/** The lit resource ids, or null when nothing is isolated. */
export function useLit(): Set<string> | null {
  return useContext(Lit);
}

/** What a frame's opacity should be: full when nothing is isolated or when it
 *  holds something lit, faded when the isolation has passed it by. The frame
 *  around the lit resource stays legible on purpose · it is how you see
 *  *where* the lit thing is. */
export function frameDim(lit: Set<string> | null, memberIds: Iterable<string>): boolean {
  if (!lit) return false;
  for (const id of memberIds) if (lit.has(id)) return false;
  return true;
}
