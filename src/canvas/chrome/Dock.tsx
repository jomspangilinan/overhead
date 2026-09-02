"use client";

// A docked column. It reserves space in the shell's grid — nothing floats
// over the canvas — and collapses to a thin labelled spine. Optional tabs;
// an optional sticky row above the scrolling body (the Add tab's search).

import type { ReactNode } from "react";
import { Icon } from "../Icon";

export interface DockTab {
  id: string;
  label: string;
}

export function Dock({
  side,
  width,
  collapsed,
  onToggle,
  title,
  count,
  tabs,
  activeTab,
  onTab,
  sticky,
  children,
}: {
  side: "left" | "right";
  width: number;
  collapsed: boolean;
  onToggle: () => void;
  title: string;
  count?: string;
  tabs?: DockTab[];
  activeTab?: string;
  onTab?: (id: string) => void;
  sticky?: ReactNode;
  children: ReactNode;
}) {
  if (collapsed) {
    return (
      <aside
        className="flex w-7 flex-col items-center py-2"
        style={{
          background: "var(--panel)",
          borderLeft: side === "right" ? "1px solid var(--line)" : undefined,
          borderRight: side === "left" ? "1px solid var(--line)" : undefined,
        }}
      >
        <button
          className="grid h-6 w-6 place-items-center rounded-md text-ink-3 hover:bg-[var(--hover-2)] hover:text-ink-2"
          title={`Show ${title}`}
          aria-label={`Show ${title}`}
          onClick={onToggle}
        >
          <Icon name={side === "left" ? "chevronRight" : "chevronLeft"} size={13} />
        </button>
        <span
          className="mt-3 select-none text-[9.5px] font-semibold uppercase tracking-[0.14em]"
          style={{
            color: "var(--ink-4)",
            writingMode: "vertical-rl",
            transform: "rotate(180deg)",
          }}
        >
          {title}
        </span>
      </aside>
    );
  }

  return (
    <aside
      className="oh-dock flex min-h-0 flex-col"
      style={{
        ["--dock-w" as string]: `${width}px`,
        background: "var(--panel)",
        borderLeft: side === "right" ? "1px solid var(--line)" : undefined,
        borderRight: side === "left" ? "1px solid var(--line)" : undefined,
      }}
    >
      <div
        className="flex h-[38px] flex-none items-center gap-2 pl-[13px] pr-2"
        style={{ borderBottom: "1px solid var(--line)" }}
      >
        {tabs ? (
          <div className="flex gap-0.5">
            {tabs.map((t) => (
              <button
                key={t.id}
                className="rounded-md px-2 py-1 text-[11.5px] font-semibold"
                style={{
                  color: activeTab === t.id ? "var(--ink-15)" : "var(--ink-3)",
                  background: activeTab === t.id ? "var(--accent-bg)" : undefined,
                }}
                onClick={() => onTab?.(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        ) : (
          <span className="text-[11.5px] font-semibold" style={{ color: "var(--ink-15)" }}>
            {title}
          </span>
        )}
        {count ? (
          <span
            className="text-[10px]"
            style={{ fontFamily: "var(--font-mono-jb)", color: "var(--ink-4)" }}
          >
            {count}
          </span>
        ) : null}
        <button
          className="ml-auto grid h-6 w-6 place-items-center rounded-[7px] text-ink-3 hover:bg-[var(--hover-2)] hover:text-ink-2"
          title={`Hide ${title}`}
          aria-label={`Hide ${title}`}
          onClick={onToggle}
        >
          <Icon name={side === "left" ? "chevronLeft" : "chevronRight"} size={13} />
        </button>
      </div>
      {sticky ? <div className="flex-none">{sticky}</div> : null}
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </aside>
  );
}
