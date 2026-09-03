"use client";

// The shell: a docked grid · rail · left dock · canvas · right dock · with a
// top bar and a bottom bar. Panels reserve space; only two small pills float
// over the canvas.

import { useEffect } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import type { StateSnapshot, CardShow, CostDisplay } from "@/engine/model";
import { useStore } from "@/store/useStore";
import { readImportLink } from "@/engine/iac/share";
import { Sprite } from "./Sprite";
import { Canvas } from "./Canvas";
import { Inspector } from "./Inspector";
import { CodePanel } from "./CodePanel";
import { PaletteFloat } from "./Palette";
import { ScenarioBanner } from "./ScenarioBanner";
import { ExportPanel } from "./ExportPanel";
import { ImportPanel } from "./ImportPanel";
import { BillDrop } from "./BillDrop";
import { Keyboard } from "./Keyboard";
import { HowTo } from "./HowTo";
import { Notice } from "./Notice";
import { TracePill } from "./TracePill";
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
  // Two views of the same object: the form for the selected thing, and the
  // whole drawing as a document. Tabs rather than a second dock · the code
  // view wants the Inspector's width, and you read one at a time.
  const tab = useStore((s) => s.rightTab);
  const setTab = useStore((s) => s.setRightTab);
  return (
    <div className="oh-right relative flex min-h-0">
      <Dock
        side="right"
        width={tab === "code" ? 360 : 300}
        collapsed={!open}
        onToggle={() => setOpen(!open)}
        title={tab === "code" ? "Code" : "Inspector"}
        tabs={[
          { id: "inspector", label: "Inspector" },
          { id: "code", label: "Code" },
        ]}
        activeTab={tab}
        onTab={(id) => setTab(id as "inspector" | "code")}
      >
        {tab === "code" ? <CodePanel /> : <Inspector />}
      </Dock>
    </div>
  );
}

/** A drawing handed over as a link · `#doc=` or `#template=` (`iac/share.ts`).
 *
 *  This is the "visualise my architecture" path without a file: your coding
 *  agent has the repo, synthesises a template and hands you a URL. It opens
 *  the **Import dialog** with the document loaded rather than replacing what
 *  is on your canvas · a link from somebody else is exactly the case the
 *  diff-before-anything-happens rule exists for. The hash is cleared once
 *  read, so a refresh does not re-open it. */
function LinkImport() {
  const setImportPanel = useStore((s) => s.setImportPanel);
  const notify = useStore((s) => s.notify);

  useEffect(() => {
    let cancelled = false;
    void readImportLink(window.location.href).then((link) => {
      if (!link || cancelled) return;
      history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search.replace(/[?&](doc|p|template)=[^&]*/g, ""),
      );
      if (link.kind === "error") {
        notify(link.message, "bad");
        return;
      }
      if (link.kind === "doc") {
        setImportPanel({ fileName: "from a link", template: link.text });
        return;
      }
      if (link.kind !== "template") return;
      const where = new URL(link.url).host;
      setImportPanel({ fileName: `${where} · fetching`, template: "" });
      void fetch(link.url)
        .then(async (r) => {
          if (!r.ok) throw new Error(`${r.status}`);
          const text = await r.text();
          if (text.length > 512 * 1024) throw new Error("too large");
          if (!cancelled) setImportPanel({ fileName: link.url.split("/").pop() || where, template: text });
        })
        .catch(() => {
          if (cancelled) return;
          setImportPanel(null);
          // The browser does the fetching, so the host has to allow a
          // cross-origin read · and with no backend there is nothing to proxy
          // it through. Naming hosts that work turns a dead end into a step.
          notify(
            `Could not read that template from ${where} · it has to be served cross-origin. GitHub raw, Gist raw and dpaste.org are; pastebin.com is not.`,
            "bad",
          );
        });
    });
    return () => {
      cancelled = true;
    };
  }, [setImportPanel, notify]);
  return null;
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
      // The samples are arranged on disk (`npm run layout-samples`), so the
      // seed just loads one. It used to re-run auto-layout here, which is
      // why the app's copy of event-driven and the one you imported were two
      // different drawings · the sample was the sketch and only this path
      // ever tidied it.
      const snap = SAMPLES["event-driven"];
      loadSnapshot({ ...snap, nodes: snap.nodes.map((n) => ({ ...n })) });
      useStore.getState().setDrawingName("event-driven");
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
          <TracePill />
          <Popovers />
          <Toolbar />
          <ZoomPill />
        </div>
        <RightDock />
        <div className="oh-bottom">
          <BottomBar />
        </div>
      </div>
      {/* a dialog, not an overlay inside the right dock · Export used to do
          nothing at all while that dock was collapsed */}
      <ExportPanel />
      <ImportPanel samples={SAMPLES} />
      <Sprite />
      <Autosave />
      <Keyboard />
      <LinkImport />
    </ReactFlowProvider>
  );
}
