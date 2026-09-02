"use client";

// The zoom pill (bottom-right). The toolbar owns the bottom-centre and its
// View gear holds the layer switches (chrome/Toolbar.tsx, Popovers.tsx).

import { useReactFlow } from "@xyflow/react";
import { useStore } from "@/store/useStore";
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

export function GearGlyph({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="2.4" />
      <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" />
    </svg>
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
