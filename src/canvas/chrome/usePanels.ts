"use client";

// Panel geometry lives in its own store, deliberately NOT in useStore:
// App's autosave and the undo history both subscribe to every useStore
// change, and dragging a panel must not write a model snapshot or an
// undo step.

import { create } from "zustand";

export interface PanelBox {
  left?: number;
  top?: number;
  min?: boolean;
}

const KEY = "overhead-panels-v1";

function load(): Record<string, PanelBox> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, PanelBox>;
  } catch {
    return {};
  }
}

interface PanelState {
  boxes: Record<string, PanelBox>;
  hydrated: boolean;
  hydrate: () => void;
  setBox: (id: string, box: PanelBox) => void;
  toggleMin: (id: string) => void;
  reset: () => void;
}

export const usePanels = create<PanelState>((set, get) => ({
  boxes: {},
  hydrated: false,

  // Hydrate after mount — reading localStorage during render breaks the
  // static export's HTML/DOM match.
  hydrate: () => {
    if (get().hydrated) return;
    set({ boxes: load(), hydrated: true });
  },

  setBox: (id, box) =>
    set((s) => {
      const boxes = { ...s.boxes, [id]: { ...s.boxes[id], ...box } };
      try {
        localStorage.setItem(KEY, JSON.stringify(boxes));
      } catch {
        // best-effort
      }
      return { boxes };
    }),

  toggleMin: (id) => get().setBox(id, { min: !get().boxes[id]?.min }),

  reset: () => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      // best-effort
    }
    set({ boxes: {} });
  },
}));
