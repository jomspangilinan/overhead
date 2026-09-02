"use client";

// The shell: a docked grid · rail · left dock · canvas · right dock · with a
// top bar and a bottom bar. Panels reserve space; only two small pills float
// over the canvas.

import { useEffect } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import type { StateSnapshot, CardShow, CostDisplay } from "@/engine/model";
import { autoLayout } from "@/engine/layout";
import { useStore } from "@/store/useStore";
import { Sprite } from "./Sprite";
import { Canvas } from "./Canvas";
import { Inspector } from "./Inspector";
import { PaletteFloat } from "./Palette";
import { TemplatesDialog } from "./Templates";
import { ScenarioBanner } from "./ScenarioBanner";
import { ExportPanel } from "./ExportPanel";
import { BillDrop } from "./BillDrop";
import { Keyboard } from "./Keyboard";
import { HowTo } from "./HowTo";
import { Notice } from "./Notice";
import { Toolbar } from "./chrome/Toolbar";
import { Popovers } from "./Popovers";
import { Dock } from "./chrome/Dock";
import { TopBar } from "./chrome/TopBar";
import { BottomBar } from "./chrome/BottomBar";
import { ZoomPill } from "./chrome/Floats";
import { LayersPanel } from "./chrome/LayersPanel";
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
            drawingName: s.drawingName,
            gridOn: s.gridOn,
            ui: { cardShow: s.cardShow, costDisplay: s.costDisplay },
          }),
        );
      } catch {
        // storage full or unavailable · autosave is best-effort
      }
    });
    return unsub;
  }, []);
  return null;
}

function LeftDock() {
  const open = useStore((s) => s.leftDock);
  const setOpen = useStore((s) => s.setLeftDock);
  const count = useStore((s) => `${s.containers.length}c · ${s.nodes.length}`);

  return (
    <div className="oh-left flex min-h-0">
      <Dock side="left" width={248} collapsed={!open} onToggle={() => setOpen(!open)} title="Layers" count={count}>
        <LayersPanel />
      </Dock>
    </div>
  );
}

function RightDock() {
  const open = useStore((s) => s.rightDock);
  const setOpen = useStore((s) => s.setRightDock);
  return (
    <div className="oh-right relative flex min-h-0">
      <Dock
        side="right"
        width={300}
        collapsed={!open}
        onToggle={() => setOpen(!open)}
        title="Inspector"
      >
        <Inspector />
      </Dock>
      {open ? <ExportPanel /> : null}
    </div>
  );
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
        const snap = JSON.parse(saved) as StateSnapshot & {
          drawingName?: string;
          gridOn?: boolean;
          ui?: { cardShow?: Partial<CardShow>; costDisplay?: Partial<CostDisplay> };
        };
        if (Array.isArray(snap.nodes) && snap.nodes.length > 0) {
          loadSnapshot(snap);
          if (snap.drawingName) useStore.getState().setDrawingName(snap.drawingName);
          if (snap.gridOn === false) useStore.getState().setGridOn(false);
          if (snap.ui?.cardShow) useStore.getState().setCardShow(snap.ui.cardShow);
          if (snap.ui?.costDisplay) useStore.getState().setCostDisplay(snap.ui.costDisplay);
          restored = true;
        }
      }
    } catch {
      // corrupt autosave · fall through to the seed
    }
    if (!restored) {
      const snap = SAMPLES["event-driven"];
      loadSnapshot({ ...snap, nodes: snap.nodes.map((n) => ({ ...n })) });
      useStore.getState().setDrawingName("event-driven");
      const positions = autoLayout(useStore.getState().nodes);
      for (const [id, p] of Object.entries(positions)) {
        useStore.getState().moveNode(id, p.x, p.y);
      }
    }
  }, [loadSnapshot]);

  return (
    <ReactFlowProvider>
      <div className="oh-shell">
        <div className="oh-top">
          <TopBar />
        </div>
        <LeftDock />
        <div className="oh-main">
          <div className="oh-stage" />
          <Canvas />
          <ScenarioBanner />
          <BillDrop />
          <HowTo />
          <PaletteFloat />
          <Notice />
          <Popovers />
          <Toolbar />
          <ZoomPill />
        </div>
        <RightDock />
        <div className="oh-bottom">
          <BottomBar />
        </div>
      </div>
      <TemplatesDialog samples={SAMPLES} />
      <Sprite />
      <Autosave />
      <Keyboard />
    </ReactFlowProvider>
  );
}
