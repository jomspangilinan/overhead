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

function SampleBar() {
  const loadSnapshot = useStore((s) => s.loadSnapshot);
  const applyAutoLayout = useStore((s) => s.applyAutoLayout);
  return (
    <div className="flex items-center gap-1.5 border-b border-rule bg-surface px-3 py-1.5">
      <span className="text-[10.5px] uppercase tracking-wider text-ink-3">
        Samples
      </span>
      {Object.keys(SAMPLES).map((name) => (
        <button
          key={name}
          className="rounded border border-rule px-2 py-0.5 text-[11.5px] hover:bg-surface-2"
          onClick={() => {
            loadSnapshot(SAMPLES[name]);
            applyAutoLayout();
          }}
        >
          {name}
        </button>
      ))}
      <button
        className="ml-auto rounded border border-rule px-2 py-0.5 text-[11.5px] hover:bg-surface-2"
        onClick={applyAutoLayout}
      >
        Auto-layout
      </button>
    </div>
  );
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
      const snap = SAMPLES["api-backend"];
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
        <SampleBar />
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
