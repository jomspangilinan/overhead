"use client";

// Undo/redo over the model slice. Snapshots are pushed on every model
// mutation (debounced by identity), capped at 50.

import { useStore, snapshotOf } from "./useStore";
import type { StateSnapshot } from "@/engine/model";

const past: StateSnapshot[] = [];
const future: StateSnapshot[] = [];
let current: string | null = null;
let applying = false;

export function initHistory(): () => void {
  current = JSON.stringify(snapshotOf(useStore.getState()));
  return useStore.subscribe((s) => {
    if (applying) return;
    const next = JSON.stringify(snapshotOf(s));
    if (next === current) return;
    if (current !== null) {
      past.push(JSON.parse(current));
      if (past.length > 50) past.shift();
    }
    future.length = 0;
    current = next;
  });
}

function apply(snap: StateSnapshot) {
  applying = true;
  try {
    useStore.getState().loadSnapshot(snap);
    current = JSON.stringify(snapshotOf(useStore.getState()));
  } finally {
    applying = false;
  }
}

export function undo(): boolean {
  const prev = past.pop();
  if (!prev || current === null) return false;
  future.push(JSON.parse(current));
  apply(prev);
  return true;
}

export function redo(): boolean {
  const next = future.pop();
  if (!next || current === null) return false;
  past.push(JSON.parse(current));
  apply(next);
  return true;
}
