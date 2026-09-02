"use client";

// The tool switcher: one floating pill at the bottom-centre of the canvas
// (the Figma / Claude Design arrangement the user asked for). Every button
// does something, every printed key is a real binding (Keyboard.tsx), and
// every button grows a tooltip above it on hover.

import { useStore, type Tool } from "@/store/useStore";
import { undo, redo } from "@/store/history";
import { Icon } from "../Icon";
import { GearGlyph } from "./Floats";

export function ToolButton({
  icon,
  hint,
  tip,
  active,
  onClick,
  size = 17,
}: {
  icon: string;
  hint?: string;
  tip: string;
  active?: boolean;
  onClick: () => void;
  size?: number;
}) {
  return (
    <button
      data-tip={tip}
      data-tip-pos="top"
      aria-label={tip}
      aria-pressed={active}
      onClick={onClick}
      className="relative grid h-[34px] w-[34px] place-items-center rounded-[9px] transition-colors hover:bg-[var(--hover-2)]"
      style={{
        background: active ? "var(--accent-bg)" : undefined,
        color: active ? "var(--accent-ink)" : "var(--ink-3)",
      }}
    >
      <Icon name={icon} size={size} />
      {hint ? (
        <span
          aria-hidden
          className="absolute bottom-[2px] right-[4px] text-[7.5px]"
          style={{ fontFamily: "var(--font-mono-jb)", color: active ? "var(--accent-ink)" : "var(--ink-4)" }}
        >
          {hint}
        </span>
      ) : null}
    </button>
  );
}

const Sep = () => <div className="mx-[3px] h-5 w-px self-center" style={{ background: "var(--line-2)" }} />;

/** Pick a tool; picking the active one drops back to select. Add and
 *  Container open the floating palette (containers first for B); Sections
 *  reveals the layer tree. */
export function pickTool(t: Tool) {
  const s = useStore.getState();
  const next = s.tool === t ? "select" : t;
  s.setTool(next);
  s.setPalette(next === "add" || next === "container");
  if (next === "section") s.setLeftDock(true);
}

export function Toolbar() {
  const tool = useStore((s) => s.tool);
  const gridOn = useStore((s) => s.gridOn);
  const setGridOn = useStore((s) => s.setGridOn);
  const cardsForced = useStore((s) => s.cardsForced);
  const setCardsForced = useStore((s) => s.setCardsForced);
  const applyAutoLayout = useStore((s) => s.applyAutoLayout);
  const setPopover = useStore((s) => s.setPopover);

  return (
    <nav
      className="oh-toolbar glass absolute z-[7] flex items-center gap-[2px] rounded-xl p-1"
      style={{ left: "50%", bottom: 14, transform: "translateX(-50%)" }}
      aria-label="Tools"
    >
      <ToolButton icon="select" hint="V" tip="Select · V" active={tool === "select"} onClick={() => pickTool("select")} />
      <ToolButton icon="pan" hint="H" tip="Hand — pan the canvas · H" active={tool === "pan"} onClick={() => pickTool("pan")} />
      <Sep />
      <ToolButton icon="plus" hint="A" tip="Add a service · A" active={tool === "add"} onClick={() => pickTool("add")} />
      <ToolButton icon="connect" hint="C" tip="Connect — drag from a node's side · C" active={tool === "connect"} onClick={() => pickTool("connect")} />
      <ToolButton icon="container" hint="B" tip="Add a container · B" active={tool === "container"} onClick={() => pickTool("container")} />
      <ToolButton icon="section" hint="S" tip="Sections · S" active={tool === "section"} onClick={() => pickTool("section")} />
      <Sep />
      <ToolButton icon="trace" hint="T" tip="Trace a request — then click a node · T" active={tool === "trace"} onClick={() => pickTool("trace")} />
      <ToolButton icon="layout" hint="L" tip="Auto-layout · L" onClick={applyAutoLayout} />
      <ToolButton icon="cards" hint="K" tip="Card view · K" active={cardsForced} onClick={() => setCardsForced(!cardsForced)} />
      <button
        data-tip="What cards show"
        data-tip-pos="top"
        aria-label="Card settings"
        className="grid h-[34px] w-[16px] place-items-center rounded-[6px] hover:bg-[var(--hover-2)]"
        style={{ color: "var(--ink-4)", marginLeft: -4 }}
        onClick={(e) => {
          const host = (e.currentTarget as HTMLElement).closest(".oh-main")?.getBoundingClientRect();
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setPopover({ kind: "cards", x: r.left + r.width / 2 - (host?.left ?? 0), y: r.top - (host?.top ?? 0) - 8 });
        }}
      >
        <GearGlyph size={10} />
      </button>
      <Sep />
      <ToolButton icon="grid" hint="⇧G" tip="Grid · ⇧G" active={gridOn} onClick={() => setGridOn(!gridOn)} />
      <ToolButton icon="undo" hint="⌘Z" tip="Undo · ⌘Z" onClick={() => undo()} />
      <ToolButton icon="redo" hint="⇧⌘Z" tip="Redo · ⇧⌘Z" onClick={() => redo()} />
    </nav>
  );
}
