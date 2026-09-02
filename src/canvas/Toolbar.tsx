"use client";

// One quiet row of iconography. Groups (hairline-divided): layers · view ·
// zoom · samples/layout — then region, the monthly total (the loud thing),
// and Export. Every icon carries a tooltip; the total needs no explaining.

import { useEffect, useRef, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import {
  useStore,
  pricingOf,
  snapshotOf,
  PRICING_TABLES,
  type Layer,
} from "@/store/useStore";
import { monthlyTotal } from "@/engine/cost";
import { toMoney, type StateSnapshot } from "@/engine/model";
import { Icon } from "./Icon";
import apiBackend from "../../samples/api-backend.json";
import mediaPipeline from "../../samples/media-pipeline.json";
import eventDriven from "../../samples/event-driven.json";

const SAMPLES: Record<string, StateSnapshot> = {
  "api-backend": apiBackend as StateSnapshot,
  "media-pipeline": mediaPipeline as StateSnapshot,
  "event-driven": eventDriven as StateSnapshot,
};

const LAYER_META: { layer: Layer; icon: string; tip: string }[] = [
  { layer: "request", icon: "request", tip: "Request edges (sync)" },
  { layer: "events", icon: "events", tip: "Event edges (async)" },
  { layer: "data", icon: "data", tip: "Data edges" },
  { layer: "security", icon: "security", tip: "Security badges" },
  { layer: "cost", icon: "cost", tip: "Cost on every node" },
];

function IconBtn({
  icon,
  tip,
  on,
  onClick,
}: {
  icon: string;
  tip: string;
  on?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      data-tip={tip}
      aria-label={tip}
      aria-pressed={on}
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
        on
          ? "bg-accent text-white"
          : "text-ink-2 hover:bg-panel-2 hover:text-ink"
      }`}
    >
      <Icon name={icon} />
    </button>
  );
}

function Divider() {
  return <span className="mx-1.5 h-5 w-px bg-rule" aria-hidden />;
}

function SamplesMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const loadSnapshot = useStore((s) => s.loadSnapshot);
  const applyAutoLayout = useStore((s) => s.applyAutoLayout);
  const { fitView } = useReactFlow();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as globalThis.Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <IconBtn
        icon="samples"
        tip="Load a sample architecture"
        on={open}
        onClick={() => setOpen((o) => !o)}
      />
      {open ? (
        <div className="absolute left-0 top-9 z-[70] w-44 rounded-lg border border-line bg-panel p-1 shadow-lg">
          {Object.keys(SAMPLES).map((name) => (
            <button
              key={name}
              className="block w-full rounded px-2.5 py-1.5 text-left text-[12px] hover:bg-panel-2"
              onClick={() => {
                loadSnapshot(SAMPLES[name]);
                applyAutoLayout();
                setOpen(false);
                requestAnimationFrame(() =>
                  fitView({ maxZoom: 1, padding: 0.15, duration: 150 }),
                );
              }}
            >
              {name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function Toolbar() {
  const layers = useStore((s) => s.layers);
  const setLayer = useStore((s) => s.setLayer);
  const cardsForced = useStore((s) => s.cardsForced);
  const setCardsForced = useStore((s) => s.setCardsForced);
  const applyAutoLayout = useStore((s) => s.applyAutoLayout);
  const zoom = useStore((s) => s.zoom);
  const region = useStore((s) => s.region);
  const setRegion = useStore((s) => s.setRegion);
  const nodes = useStore((s) => s.nodes);
  const edges = useStore((s) => s.edges);
  const traffic = useStore((s) => s.traffic);
  const total = (() => {
    try {
      void nodes;
      void edges;
      void traffic;
      const s = useStore.getState();
      return monthlyTotal(snapshotOf(s), pricingOf(s));
    } catch {
      return 0;
    }
  })();
  const generatedAt = useStore((s) => pricingOf(s).generatedAt.slice(0, 10));
  const { zoomTo, fitView } = useReactFlow();

  const applyZoom = (z: number) => {
    const clamped = Math.max(0.4, Math.min(2, Math.round(z * 20) / 20));
    zoomTo(clamped, { duration: 120 });
  };

  return (
    <div className="flex items-center gap-1 border-b border-line bg-panel px-3 py-1.5">
      <span
        className="mr-2 text-[15px] font-bold tracking-tight"
        style={{ fontFamily: "var(--font-archivo)" }}
      >
        Overhead
      </span>

      {LAYER_META.map(({ layer, icon, tip }) => (
        <IconBtn
          key={layer}
          icon={icon}
          tip={tip}
          on={layers[layer]}
          onClick={() => setLayer(layer, !layers[layer])}
        />
      ))}

      <Divider />

      <IconBtn
        icon="cards"
        tip="Card view (settings + cost)"
        on={cardsForced}
        onClick={() => setCardsForced(!cardsForced)}
      />

      <Divider />

      <button
        data-tip="Zoom out"
        aria-label="Zoom out"
        className="flex h-7 w-6 items-center justify-center rounded-md text-[14px] text-ink-2 hover:bg-panel-2"
        onClick={() => applyZoom(zoom - 0.2)}
      >
        −
      </button>
      <input
        type="range"
        min={40}
        max={200}
        value={Math.round(zoom * 100)}
        onChange={(e) => applyZoom(Number(e.target.value) / 100)}
        className="w-20 accent-[var(--accent)]"
        aria-label="Zoom"
      />
      <button
        data-tip="Zoom in"
        aria-label="Zoom in"
        className="flex h-7 w-6 items-center justify-center rounded-md text-[14px] text-ink-2 hover:bg-panel-2"
        onClick={() => applyZoom(zoom + 0.2)}
      >
        +
      </button>
      <span
        className="w-9 text-right text-[10.5px] tabular-nums text-ink-3"
        style={{ fontFamily: "var(--font-mono-jb)" }}
      >
        {Math.round(zoom * 100)}%
      </span>
      <IconBtn
        icon="fit"
        tip="Fit to view"
        onClick={() => fitView({ duration: 150, maxZoom: 1, padding: 0.15 })}
      />

      <Divider />

      <SamplesMenu />
      <IconBtn icon="layout" tip="Auto-layout by role" onClick={applyAutoLayout} />

      <div className="ml-auto flex items-center gap-2">
        <a
          data-tip={`AWS Price List · fetched ${generatedAt}`}
          aria-label="Pricing source"
          className="flex h-7 w-7 items-center justify-center rounded-md text-ink-3 hover:bg-panel-2 hover:text-ink"
          href="https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/index.json"
          target="_blank"
          rel="noreferrer"
        >
          <Icon name="info" />
        </a>
        <select
          className="rounded-md border border-line bg-panel px-1.5 py-1 text-[11px] text-ink-2"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          aria-label="Pricing region"
          style={{ fontFamily: "var(--font-mono-jb)" }}
        >
          {Object.keys(PRICING_TABLES).map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
        <span
          className="text-[16px] font-semibold tabular-nums"
          style={{ fontFamily: "var(--font-mono-jb)" }}
        >
          ${toMoney(total).toFixed(2)}
          <span className="text-[10.5px] text-ink-3">/mo</span>
        </span>
        <button
          className="flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1.5 text-[11.5px] font-semibold text-white"
          onClick={() => useStore.getState().setExportPanel("markdown")}
        >
          <Icon name="export" size={13} />
          Export
        </button>
      </div>
    </div>
  );
}
