"use client";

// The floating pills: layers top-left, zoom bottom-right. The toolbar owns
// the bottom-centre (chrome/Toolbar.tsx).

import { useReactFlow } from "@xyflow/react";
import { useStore, type Layer } from "@/store/useStore";
import { Icon } from "../Icon";

function Shell({
  children,
  style,
}: {
  children: React.ReactNode;
  style: React.CSSProperties;
}) {
  return (
    <div
      className="oh-float glass absolute z-[7] flex items-center gap-0.5 rounded-xl p-1"
      style={style}
    >
      {children}
    </div>
  );
}

function FloatButton({
  label,
  on,
  square,
  onClick,
  title,
  tipPos,
  children,
}: {
  label?: string;
  on?: boolean;
  square?: boolean;
  onClick: () => void;
  title?: string;
  tipPos?: "top" | "bottom";
  children?: React.ReactNode;
}) {
  return (
    <button
      aria-pressed={on}
      data-tip={title ?? label}
      data-tip-pos={tipPos}
      aria-label={title ?? label}
      onClick={onClick}
      className={`rounded-lg text-[11px] font-medium hover:bg-[var(--hover-2)] ${
        square ? "grid h-[26px] w-7 place-items-center" : "px-2.5 py-1.5"
      }`}
      style={{
        background: on ? "var(--accent-bg)" : undefined,
        color: on ? "var(--ink-15)" : "var(--ink-3)",
      }}
    >
      {children ?? label}
    </button>
  );
}

const SWITCHES: { layer: Layer; label: string }[] = [
  { layer: "sections", label: "Sections" },
  { layer: "security", label: "Security" },
  { layer: "cost", label: "Cost" },
];

export function LayerSwitch() {
  const layers = useStore((s) => s.layers);
  const setLayer = useStore((s) => s.setLayer);
  return (
    <Shell style={{ left: 14, top: 14 }}>
      {SWITCHES.map(({ layer, label }) => (
        <FloatButton
          key={layer}
          label={label}
          title={`${label} layer`}
          on={layers[layer]}
          onClick={() => setLayer(layer, !layers[layer])}
        />
      ))}
      <span
        className="mx-[3px] w-px self-stretch"
        style={{ background: "var(--line)" }}
      />
      {(["request", "events", "data"] as Layer[]).map((layer) => (
        <FloatButton
          key={layer}
          square
          title={`${layer} edges`}
          on={layers[layer]}
          onClick={() => setLayer(layer, !layers[layer])}
        >
          <Icon name={layer} size={14} />
        </FloatButton>
      ))}
    </Shell>
  );
}

export function ZoomPill() {
  const zoom = useStore((s) => s.zoom);
  const { zoomTo, fitView } = useReactFlow();
  const applyZoom = (z: number) =>
    zoomTo(Math.max(0.5, Math.min(1.8, Math.round(z * 20) / 20)), {
      duration: 120,
    });

  return (
    <Shell style={{ right: 14, bottom: 14 }}>
      <FloatButton square tipPos="top" title="Zoom out · scroll" onClick={() => applyZoom(zoom - 0.15)}>
        <Icon name="minus" size={15} />
      </FloatButton>
      <button
        className="min-w-[42px] rounded-md px-1 text-center text-[11px] hover:bg-[var(--hover-2)]"
        style={{ fontFamily: "var(--font-mono-jb)", color: "var(--ink-15)" }}
        data-tip="Reset to 100%"
        data-tip-pos="top"
        aria-label="Reset zoom to 100%"
        onClick={() => applyZoom(1)}
      >
        {Math.round(zoom * 100)}%
      </button>
      <FloatButton square tipPos="top" title="Zoom in" onClick={() => applyZoom(zoom + 0.15)}>
        <Icon name="plus" size={15} />
      </FloatButton>
      <FloatButton
        square
        tipPos="top"
        title="Fit to view"
        onClick={() => fitView({ duration: 150, maxZoom: 1, padding: 0.15 })}
      >
        <Icon name="fit" size={14} />
      </FloatButton>
    </Shell>
  );
}
