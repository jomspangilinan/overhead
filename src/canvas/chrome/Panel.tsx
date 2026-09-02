"use client";

// A floating panel: drag by the header, collapse to the title bar, remember
// where it was put. Every panel in the app is one of these — nothing is a
// fixed sidebar.

import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "../Icon";
import { usePanels } from "./usePanels";

export interface PanelDefaults {
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
  width?: number | "auto";
  height?: number | "auto";
}

export function Panel({
  id,
  title,
  count,
  defaults,
  headerHeight = 38,
  children,
}: {
  id: string;
  title: string;
  count?: string;
  defaults: PanelDefaults;
  headerHeight?: number;
  children: ReactNode;
}) {
  const box = usePanels((s) => s.boxes[id]);
  const setBox = usePanels((s) => s.setBox);
  const toggleMin = usePanels((s) => s.toggleMin);
  const hydrate = usePanels((s) => s.hydrate);
  const ref = useRef<HTMLElement>(null);
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  useEffect(() => hydrate(), [hydrate]);

  const dragged = box?.left !== undefined && box?.top !== undefined;
  const min = box?.min ?? false;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const el = ref.current;
    if (!el) return;
    // Freeze the current rect to left/top so right/bottom-anchored panels
    // convert cleanly on first grab.
    const r = el.getBoundingClientRect();
    drag.current = { sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top };
    setBox(id, { left: r.left, top: r.top });
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.style.cursor = "grabbing";
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = ref.current;
    if (!d || !el) return;
    const left = Math.max(
      4,
      Math.min(window.innerWidth - el.offsetWidth - 4, d.ox + e.clientX - d.sx),
    );
    const top = Math.max(4, Math.min(window.innerHeight - 42, d.oy + e.clientY - d.sy));
    setBox(id, { left, top });
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    drag.current = null;
    e.currentTarget.style.cursor = "grab";
  };

  return (
    <section
      ref={ref}
      className="glass fixed z-[6] flex flex-col overflow-hidden rounded-[15px]"
      style={{
        left: dragged ? box!.left : defaults.left,
        top: dragged ? box!.top : defaults.top,
        right: dragged ? undefined : defaults.right,
        bottom: dragged ? undefined : defaults.bottom,
        width: defaults.width ?? 238,
        height: min ? headerHeight : (defaults.height ?? "auto"),
        transition: "height .16s ease",
      }}
    >
      <div
        className="flex flex-none cursor-grab select-none items-center gap-2 pl-[13px] pr-2"
        style={{
          height: headerHeight,
          borderBottom: min ? "none" : "1px solid var(--line)",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <span
          className="text-[11.5px] font-semibold"
          style={{ color: "var(--ink-15)" }}
        >
          {title}
        </span>
        {count ? (
          <span
            className="text-[10px]"
            style={{ fontFamily: "var(--font-mono-jb)", color: "var(--ink-4)" }}
          >
            {count}
          </span>
        ) : null}
        <span className="ml-auto flex gap-0.5">
          <button
            aria-label={min ? "Expand panel" : "Collapse panel"}
            className="grid h-6 w-6 place-items-center rounded-[7px] text-ink-3 hover:bg-[var(--hover-2)] hover:text-ink-2"
            onClick={() => toggleMin(id)}
          >
            <Icon name={min ? "plus" : "minus"} size={13} />
          </button>
        </span>
      </div>
      {min ? null : <div className="min-h-0 flex-1 overflow-auto">{children}</div>}
    </section>
  );
}
