"use client";

// Keyboard: ⌘/Ctrl+Z undo, ⌘/Ctrl+Shift+Z redo, Delete removes the
// selected node, Escape closes panels / clears selection and trace.

import { useEffect } from "react";
import { useStore } from "@/store/useStore";
import { initHistory, redo, undo } from "@/store/history";

export function Keyboard() {
  useEffect(() => {
    const unsub = initHistory();
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        const s = useStore.getState();
        if (s.selectedId) {
          e.preventDefault();
          s.removeNode(s.selectedId);
        }
        return;
      }
      if (e.key === "Escape") {
        const s = useStore.getState();
        if (s.exportPanel) s.setExportPanel(null);
        else {
          s.select(null);
          s.setTrace(null);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      unsub();
    };
  }, []);
  return null;
}
