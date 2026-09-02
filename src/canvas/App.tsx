"use client";

import { useEffect } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import type { StateSnapshot } from "@/engine/model";
import { autoLayout } from "@/engine/layout";
import { useStore } from "@/store/useStore";
import { Sprite } from "./Sprite";
import { Canvas } from "./Canvas";
import { Toolbar } from "./Toolbar";
import { Inspector } from "./Inspector";
import { Palette } from "./Palette";
import { ScenarioBanner } from "./ScenarioBanner";
import { ExportPanel } from "./ExportPanel";
import { BillDrop } from "./BillDrop";
import { Keyboard } from "./Keyboard";
import { HowTo } from "./HowTo";
import apiBackend from "../../samples/api-backend.json";
import mediaPipeline from "../../samples/media-pipeline.json";
import eventDriven from "../../samples/event-driven.json";

export const SAMPLES: Record<string, StateSnapshot> = {
  "api-backend": apiBackend as StateSnapshot,
  "media-pipeline": mediaPipeline as StateSnapshot,
  "event-driven": eventDriven as StateSnapshot,
};

const AUTOSAVE_KEY = "overhead-state-v1";

function Autosave() {
  useEffect(() => {
    const unsub = useStore.subscribe((s) => {
      try {
        localStorage.setItem(
          AUTOSAVE_KEY,
          JSON.stringify({
            nodes: s.nodes,
            edges: s.edges,
            groups: s.groups,
            traffic: s.traffic,
          }),
        );
      } catch {
        // storage full or unavailable — autosave is best-effort
      }
    });
    return unsub;
  }, []);
  return null;
}

export function App() {
  const loadSnapshot = useStore((s) => s.loadSnapshot);

  // Restore autosave; otherwise seed a sample so a first visit shows
  // value in ten seconds.
  useEffect(() => {
    if (useStore.getState().nodes.length !== 0) return;
    let restored = false;
    try {
      const saved = localStorage.getItem(AUTOSAVE_KEY);
      if (saved) {
        const snap = JSON.parse(saved) as StateSnapshot;
        if (Array.isArray(snap.nodes) && snap.nodes.length > 0) {
          loadSnapshot(snap);
          restored = true;
        }
      }
    } catch {
      // corrupt autosave — fall through to the seed
    }
    if (!restored) {
      // Seed the richest sample: async + data edges and live findings, so
      // every layer toggle visibly does something on first load.
      const snap = SAMPLES["event-driven"];
      loadSnapshot({
        ...snap,
        nodes: snap.nodes.map((n) => ({ ...n })),
      });
      const positions = autoLayout(useStore.getState().nodes);
      for (const [id, p] of Object.entries(positions)) {
        useStore.getState().moveNode(id, p.x, p.y);
      }
    }
  }, [loadSnapshot]);

  return (
    <ReactFlowProvider>
      <div className="flex h-screen flex-col">
        <Toolbar />
        <div className="flex min-h-0 flex-1">
          <Palette />
          <div className="relative min-w-0 flex-1">
            <Canvas />
            <ScenarioBanner />
            <ExportPanel />
            <BillDrop />
            <HowTo />
          </div>
          <Inspector />
        </div>
      </div>
      <Sprite />
      <Autosave />
      <Keyboard />
    </ReactFlowProvider>
  );
}
