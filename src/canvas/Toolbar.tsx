"use client";

// Top bar: layers, cards, zoom UI (−/+, slider, Fit), region, running total.

import { useReactFlow } from "@xyflow/react";
import {
  useStore,
  pricingOf,
  snapshotOf,
  PRICING_TABLES,
  type Layer,
} from "@/store/useStore";
import { monthlyTotal } from "@/engine/cost";
import { toMoney } from "@/engine/model";

const LAYERS: Layer[] = ["request", "events", "data", "security", "cost"];

function Toggle({
  on,
  label,
  onClick,
}: {
  on: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={on}
      onClick={onClick}
      className={`rounded px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wide ${
        on
          ? "bg-accent text-white"
          : "border border-rule bg-surface text-ink-2 hover:bg-surface-2"
      }`}
      style={{ fontFamily: "var(--font-archivo)" }}
    >
      {label}
    </button>
  );
}

export function Toolbar() {
  const layers = useStore((s) => s.layers);
  const setLayer = useStore((s) => s.setLayer);
  const cardsForced = useStore((s) => s.cardsForced);
  const setCardsForced = useStore((s) => s.setCardsForced);
  const showLanes = useStore((s) => s.showLanes);
  const setShowLanes = useStore((s) => s.setShowLanes);
  const zoom = useStore((s) => s.zoom);
  const region = useStore((s) => s.region);
  const setRegion = useStore((s) => s.setRegion);
  const total = useStore((s) => {
    try {
      return monthlyTotal(snapshotOf(s), pricingOf(s));
    } catch {
      return 0;
    }
  });
  const generatedAt = useStore((s) => pricingOf(s).generatedAt.slice(0, 10));
  const { zoomTo, fitView } = useReactFlow();

  const applyZoom = (z: number) => {
    const clamped = Math.max(0.4, Math.min(2, Math.round(z * 20) / 20));
    zoomTo(clamped, { duration: 120 });
  };

  return (
    <div className="flex items-center gap-2 border-b border-rule bg-surface px-3 py-2">
      <span
        className="mr-2 text-[15px] font-bold tracking-tight"
        style={{ fontFamily: "var(--font-archivo)" }}
      >
        Overhead
      </span>

      <div className="flex items-center gap-1.5">
        {LAYERS.map((l) => (
          <Toggle key={l} on={layers[l]} label={l} onClick={() => setLayer(l, !layers[l])} />
        ))}
        <Toggle on={cardsForced} label="cards" onClick={() => setCardsForced(!cardsForced)} />
        <Toggle
          on={showLanes}
          label="lanes"
          onClick={() => setShowLanes(!showLanes)}
        />
      </div>

      <div className="ml-2 flex items-center gap-1">
        <button
          className="rounded border border-rule px-2 py-0.5 text-[13px] hover:bg-surface-2"
          onClick={() => applyZoom(zoom - 0.2)}
          aria-label="Zoom out"
        >
          −
        </button>
        <input
          type="range"
          min={40}
          max={200}
          value={Math.round(zoom * 100)}
          onChange={(e) => applyZoom(Number(e.target.value) / 100)}
          className="w-24 accent-[var(--accent)]"
          aria-label="Zoom"
        />
        <button
          className="rounded border border-rule px-2 py-0.5 text-[13px] hover:bg-surface-2"
          onClick={() => applyZoom(zoom + 0.2)}
          aria-label="Zoom in"
        >
          +
        </button>
        <span
          className="w-10 text-right text-[11px] text-ink-3"
          style={{ fontFamily: "var(--font-plex-mono)" }}
        >
          {Math.round(zoom * 100)}%
        </span>
        <button
          className="rounded border border-rule px-2 py-0.5 text-[11px] hover:bg-surface-2"
          onClick={() => fitView({ duration: 150 })}
        >
          Fit
        </button>
      </div>

      <button
        className="ml-2 rounded border border-rule px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink-2 hover:bg-surface-2"
        style={{ fontFamily: "var(--font-archivo)" }}
        onClick={() => useStore.getState().setExportPanel("markdown")}
      >
        Export
      </button>

      <div className="ml-auto flex items-center gap-3">
        <a
          className="hidden text-[10.5px] text-ink-3 underline decoration-dotted lg:block"
          href="https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/index.json"
          target="_blank"
          rel="noreferrer"
        >
          AWS Price List · {region} · fetched {generatedAt}
        </a>
        <select
          className="rounded border border-rule bg-surface-2 px-1.5 py-1 text-[11.5px]"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          aria-label="Pricing region"
        >
          {Object.keys(PRICING_TABLES).map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
        <span
          className="text-[16px] font-semibold tabular-nums"
          style={{ fontFamily: "var(--font-plex-mono)" }}
        >
          ${toMoney(total).toFixed(2)}
          <span className="text-[11px] text-ink-3">/mo</span>
        </span>
      </div>
    </div>
  );
}
