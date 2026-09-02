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
import apiBackend from "../../samples/api-backend.json";
import mediaPipeline from "../../samples/media-pipeline.json";
import eventDriven from "../../samples/event-driven.json";

export const SAMPLES: Record<string, StateSnapshot> = {
  "api-backend": apiBackend as StateSnapshot,
  "media-pipeline": mediaPipeline as StateSnapshot,
  "event-driven": eventDriven as StateSnapshot,
};

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

  // Seed the canvas so a first visit shows value in ten seconds.
  useEffect(() => {
    if (useStore.getState().nodes.length === 0) {
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
          <div className="min-w-0 flex-1">
            <Canvas />
          </div>
          <Inspector />
        </div>
      </div>
      <Sprite />
    </ReactFlowProvider>
  );
}
