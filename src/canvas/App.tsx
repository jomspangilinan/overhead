"use client";

// The shell: a stage that bleeds edge to edge, an inset React Flow surface,
// and floating chrome over both. Nothing reserves space from the canvas.

import { useEffect } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import type { StateSnapshot } from "@/engine/model";
import { autoLayout } from "@/engine/layout";
import { useStore } from "@/store/useStore";
import { Sprite } from "./Sprite";
import { Canvas } from "./Canvas";
import { Inspector } from "./Inspector";
import { Palette } from "./Palette";
import { ScenarioBanner } from "./ScenarioBanner";
import { ExportPanel } from "./ExportPanel";
import { BillDrop } from "./BillDrop";
import { Keyboard } from "./Keyboard";
import { HowTo } from "./HowTo";
import { Rail } from "./chrome/Rail";
import { Panel } from "./chrome/Panel";
import { TopBar } from "./chrome/TopBar";
import { LayerSwitch, ZoomPill } from "./chrome/Floats";
import { TitleBlock } from "./chrome/TitleBlock";
import { StructurePanel } from "./chrome/StructurePanel";
import apiBackend from "../../samples/api-backend.json";
import mediaPipeline from "../../samples/media-pipeline.json";
import eventDriven from "../../samples/event-driven.json";

export const SAMPLES: Record<string, StateSnapshot> = {
  "api-backend": apiBackend as unknown as StateSnapshot,
  "media-pipeline": mediaPipeline as unknown as StateSnapshot,
  "event-driven": eventDriven as unknown as StateSnapshot,
};

const AUTOSAVE_KEY = "overhead-state-v2";
const LEGACY_KEY = "overhead-state-v1";

function Autosave() {
  useEffect(() => {
    const unsub = useStore.subscribe((s) => {
      try {
        localStorage.setItem(
          AUTOSAVE_KEY,
          JSON.stringify({
            nodes: s.nodes,
            edges: s.edges,
            containers: s.containers,
            sections: s.sections,
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

/** The radial stage behind everything; the grid itself lives inside React
 *  Flow so it pans and zooms with the drawing. */
function Stage() {
  return <div className="oh-stage" />;
}

export function App() {
  const loadSnapshot = useStore((s) => s.loadSnapshot);

  // Restore autosave (v2, falling back to v1); otherwise seed a sample so a
  // first visit shows value in ten seconds.
  useEffect(() => {
    if (useStore.getState().nodes.length !== 0) return;
    let restored = false;
    try {
      const saved =
        localStorage.getItem(AUTOSAVE_KEY) ?? localStorage.getItem(LEGACY_KEY);
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
      const snap = SAMPLES["event-driven"];
      loadSnapshot({ ...snap, nodes: snap.nodes.map((n) => ({ ...n })) });
      const positions = autoLayout(useStore.getState().nodes);
      for (const [id, p] of Object.entries(positions)) {
        useStore.getState().moveNode(id, p.x, p.y);
      }
    }
  }, [loadSnapshot]);

  return (
    <ReactFlowProvider>
      <Stage />

      <div className="oh-viewport">
        <Canvas />
        <ScenarioBanner />
        <BillDrop />
      </div>

      <Rail />
      <TopBar />

      <StructurePanel />

      <Panel
        id="add"
        title="Add"
        defaults={{ left: 80, top: 552, width: 238, height: 300 }}
      >
        <Palette />
      </Panel>

      <Panel
        id="inspector"
        title="Inspector"
        defaults={{ right: 16, top: 66, width: 320, height: 640 }}
      >
        <Inspector />
      </Panel>

      <LayerSwitch />
      <ZoomPill />
      <TitleBlock />

      <ExportPanel />
      <HowTo />
      <Sprite />
      <Autosave />
      <Keyboard />
    </ReactFlowProvider>
  );
}
