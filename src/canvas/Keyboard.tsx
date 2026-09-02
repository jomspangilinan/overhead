"use client";

// Every key the rail prints is bound here, and nothing is printed that
// isn't. Single letters pick tools; ⇧G grid; ⌘Z/⇧⌘Z undo/redo; / focuses
// search; Delete removes the selection; Escape backs out.

import { useEffect } from "react";
import { useStore } from "@/store/useStore";
import { initHistory, redo, undo } from "@/store/history";
import { pickTool } from "./chrome/Rail";

export function Keyboard() {
  useEffect(() => {
    const unsub = initHistory();
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable))
        return;
      const mod = e.metaKey || e.ctrlKey;
      const s = useStore.getState();

      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        if (s.selectedEdgeId) {
          e.preventDefault();
          s.removeEdge(s.selectedEdgeId);
          s.selectEdge(null);
        } else if (s.selectedId) {
          e.preventDefault();
          s.removeNode(s.selectedId);
        }
        return;
      }
      if (e.key === "Escape") {
        if (s.exportPanel) s.setExportPanel(null);
        else {
          s.select(null);
          s.selectEdge(null);
          s.setTrace(null);
          s.setTool("select");
        }
        return;
      }
      if (e.key === "/") {
        e.preventDefault();
        s.setLeftTab("add");
        requestAnimationFrame(() =>
          (document.getElementById("palette-search") as HTMLInputElement | null)?.focus(),
        );
        return;
      }
      if (e.shiftKey && e.key.toLowerCase() === "g") {
        e.preventDefault();
        s.setGridOn(!s.gridOn);
        return;
      }
      const tools: Record<string, Parameters<typeof pickTool>[0]> = {
        v: "select",
        h: "pan",
        a: "add",
        c: "connect",
        b: "container",
        s: "section",
        t: "trace",
      };
      const key = e.key.toLowerCase();
      if (key in tools && !e.shiftKey) {
        e.preventDefault();
        pickTool(tools[key]);
        return;
      }
      if (key === "l" && !e.shiftKey) {
        e.preventDefault();
        s.applyAutoLayout();
        return;
      }
      if (key === "k" && !e.shiftKey) {
        e.preventDefault();
        s.setCardsForced(!s.cardsForced);
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
