"use client";

// The chrome every frame shares, containers and sections alike: the border,
// a header band that drags, an optional kind icon and kind label, the name
// (double-click to rename), a right-hand cluster (stat · collapse · gear ·
// move grip) that shows only while the frame is selected or its header is
// hovered, and the corner resize grip. Rendered inside a ViewportPortal;
// the interactive parts opt back into pointer events (globals.css) and
// carry nopan/nodrag.

import { useState } from "react";
import type { Box } from "@/engine/frames";

export const HEAD_H = 34;

export interface FrameChromeProps {
  id: string;
  box: Box;
  color: string;
  dash: "solid" | "dashed" | "dotted";
  borderWidth: number;
  fill: boolean;
  radius?: number;
  selected: boolean;
  icon?: string;
  kindLabel: string;
  name: string;
  /** Second half of the editable title, e.g. a CIDR. */
  detail?: string;
  detailHint?: string;
  stat?: string;
  collapseTitle?: string;
  onCollapse?: () => void;
  onGear: (e: React.MouseEvent) => void;
  gearTitle: string;
  onRename: (name: string, detail?: string) => void;
  begin: (e: React.PointerEvent, id: string, mode: "move" | "resize", box: Box) => void;
  move: (e: React.PointerEvent) => void;
  end: (e: React.PointerEvent) => void;
  moveTitle: string;
}

const Gear = () => (
  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="8" r="2.4" />
    <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" />
  </svg>
);

const Move = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 1.5v13M1.5 8h13M8 1.5 6 3.5M8 1.5l2 2M8 14.5l-2-2M8 14.5l2-2M1.5 8l2-2M1.5 8l2 2M14.5 8l-2-2M14.5 8l-2 2" />
  </svg>
);

/** Two arrowheads pointing at each other: fold this frame to a card. */
const Collapse = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 2l5 5M7 3v4H3M14 14l-5-5M9 13V9h4" />
  </svg>
);

export function FrameChrome(p: FrameChromeProps) {
  const [editing, setEditing] = useState(false);
  const { box } = p;
  const w = box.r - box.l;
  const labelLeft = box.l + (p.icon ? 37 : 12);
  const stroke = p.selected ? "var(--accent)" : p.color;
  const clusterRight = box.r - 8;
  const btn: React.CSSProperties = {
    height: 20,
    background: p.selected ? "var(--accent-bg)" : "var(--panel)",
    border: `1px solid ${stroke}`,
    color: p.selected ? "var(--accent-ink)" : p.color,
  };
  const gestures = {
    onPointerDown: (e: React.PointerEvent) => {
      if (editing) return;
      p.begin(e, p.id, "move", box);
    },
    onPointerMove: p.move,
    onPointerUp: p.end,
    onPointerCancel: p.end,
  };
  return (
    <div className="oh-frame" data-selected={p.selected ? "true" : "false"}>
      <div
        className="pointer-events-none absolute"
        style={{
          left: box.l,
          top: box.t,
          width: w,
          height: box.b - box.t,
          borderRadius: p.radius ?? 10,
          border: `${p.selected ? Math.max(1.8, p.borderWidth) : p.borderWidth}px ${p.dash} ${stroke}`,
          background: p.fill ? `color-mix(in srgb, ${p.color} 4.5%, transparent)` : "transparent",
          boxShadow: p.selected ? "0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent)" : undefined,
        }}
      />
      {/* header band: the drag handle */}
      <div
        className="oh-frame-head nopan nodrag absolute"
        style={{ left: box.l, top: box.t, width: w, height: HEAD_H, borderRadius: `${p.radius ?? 10}px ${p.radius ?? 10}px 0 0` }}
        title={`${p.kindLabel} · drag to move with its contents · click to select`}
        {...gestures}
      />
      {p.icon ? (
        <svg className="pointer-events-none absolute" style={{ left: box.l + 7, top: box.t + 7 }} width="24" height="24">
          <use href={`#${p.icon}`} width="24" height="24" />
        </svg>
      ) : null}
      <div
        className="pointer-events-none absolute select-none whitespace-nowrap text-[8.5px] font-semibold uppercase"
        style={{ left: labelLeft, top: box.t + 8, letterSpacing: "0.9px", color: p.color, opacity: 0.85 }}
      >
        {p.kindLabel}
      </div>
      {editing ? (
        <input
          autoFocus
          defaultValue={p.detail ? `${p.name} · ${p.detail}` : p.name}
          className="oh-frame-input nodrag nopan absolute rounded bg-panel-2 px-1 text-[11.5px] font-medium outline-none"
          style={{ left: labelLeft, top: box.t + 17, width: Math.min(260, Math.max(140, w - 120)), border: "1px solid var(--accent)", color: "var(--ink-15)" }}
          title={p.detailHint}
          onBlur={(e) => {
            const [name, detail] = e.target.value.split("·").map((x) => x.trim());
            p.onRename(name || p.name, detail);
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") setEditing(false);
          }}
          onPointerDown={(e) => e.stopPropagation()}
        />
      ) : (
        <div
          className="oh-frame-name nopan nodrag absolute cursor-text select-none whitespace-nowrap text-[11.5px] font-medium"
          style={{ left: labelLeft, top: box.t + 19, maxWidth: Math.max(60, w - 130), overflow: "hidden", textOverflow: "ellipsis", color: "var(--ink-15)" }}
          title={`Double-click to rename${p.detailHint ? ` (${p.detailHint})` : ""}`}
          {...gestures}
          onDoubleClick={(e) => {
            e.stopPropagation();
            setEditing(true);
          }}
        >
          {p.detail ? `${p.name} · ${p.detail}` : p.name}
        </div>
      )}
      {/* right cluster: stat · collapse · gear · move grip · only while selected or hovered */}
      <div className="oh-frame-cluster absolute flex items-center gap-1" style={{ left: clusterRight, top: box.t + 7, transform: "translateX(-100%)" }}>
        {p.stat ? (
          <span className="pointer-events-none select-none whitespace-nowrap pr-1 text-[10px] font-semibold" style={{ color: p.color, fontFamily: "var(--font-mono-jb)" }}>
            {p.stat}
          </span>
        ) : null}
        {p.onCollapse ? (
          <button
            className="oh-frame-collapse nopan nodrag grid w-[22px] place-items-center rounded-md"
            style={btn}
            title={p.collapseTitle}
            aria-label={p.collapseTitle}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              p.onCollapse?.();
            }}
          >
            <Collapse />
          </button>
        ) : null}
        <button
          className="oh-frame-gear nopan nodrag grid w-[22px] place-items-center rounded-md"
          style={btn}
          title={p.gearTitle}
          aria-label={p.gearTitle}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={p.onGear}
        >
          <Gear />
        </button>
        <div className="oh-frame-move nopan nodrag grid w-[22px] place-items-center rounded-md" style={btn} title={p.moveTitle} {...gestures}>
          <Move />
        </div>
      </div>
      <div
        className="oh-frame-grip nopan nodrag absolute"
        style={{ left: box.r - 14, top: box.b - 14, width: 14, height: 14 }}
        title="Drag to resize · never smaller than what's inside"
        onPointerDown={(e) => p.begin(e, p.id, "resize", box)}
        onPointerMove={p.move}
        onPointerUp={p.end}
        onPointerCancel={p.end}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" stroke={p.color} strokeWidth="1.2" fill="none">
          <path d="M13 5 5 13M13 9l-4 4" />
        </svg>
      </div>
    </div>
  );
}
