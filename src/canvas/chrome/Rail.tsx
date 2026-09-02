"use client";

// The 52px tool rail. Every button here does something: the additive tools
// switch the left dock to the matching tab, connect/trace arm a canvas mode,
// and the printed key is a real binding (see Keyboard.tsx).

import { useStore, type Tool } from "@/store/useStore";
import { undo, redo } from "@/store/history";
import { Icon } from "../Icon";

function RailButton({
  icon,
  hint,
  title,
  active,
  onClick,
}: {
  icon: string;
  hint?: string;
  title: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={onClick}
      className="relative grid h-9 w-9 place-items-center rounded-[10px] transition-colors hover:bg-[var(--hover)]"
      style={{
        background: active ? "var(--accent-bg)" : undefined,
        color: active ? "var(--accent-ink)" : "var(--ink-3)",
      }}
    >
      {active ? (
        <span
          aria-hidden
          className="absolute rounded-sm"
          style={{ left: -8, top: 9, width: 2.5, height: 18, background: "var(--accent)" }}
        />
      ) : null}
      <Icon name={icon} size={17} />
      {hint ? (
        <span
          aria-hidden
          className="absolute bottom-px right-[3px] text-[7.5px]"
          style={{ fontFamily: "var(--font-mono-jb)", color: "var(--ink-4)" }}
        >
          {hint}
        </span>
      ) : null}
    </button>
  );
}

const Sep = () => <div className="my-[5px] h-px w-5" style={{ background: "var(--line)" }} />;

/** Pick a tool from the rail; picking the active one drops back to select.
 *  Add and Container open the floating palette (containers first for B);
 *  Sections reveals the layer tree. */
export function pickTool(t: Tool) {
  const s = useStore.getState();
  const next = s.tool === t ? "select" : t;
  s.setTool(next);
  s.setPalette(next === "add" || next === "container");
  if (next === "section") s.setLeftDock(true);
}

export function Rail() {
  const tool = useStore((s) => s.tool);
  const gridOn = useStore((s) => s.gridOn);
  const setGridOn = useStore((s) => s.setGridOn);
  const cardsForced = useStore((s) => s.cardsForced);
  const setCardsForced = useStore((s) => s.setCardsForced);
  const applyAutoLayout = useStore((s) => s.applyAutoLayout);
  const templatesOpen = useStore((s) => s.templatesOpen);
  const setTemplatesOpen = useStore((s) => s.setTemplatesOpen);

  return (
    <nav
      className="flex h-full w-[52px] flex-col items-center gap-[3px] py-2"
      style={{ background: "var(--panel)", borderRight: "1px solid var(--line)" }}
    >
      <RailButton icon="select" hint="V" title="Select · V" active={tool === "select"} onClick={() => pickTool("select")} />
      <RailButton icon="pan" hint="H" title="Pan · H" active={tool === "pan"} onClick={() => pickTool("pan")} />
      <Sep />
      <RailButton icon="plus" hint="A" title="Add a service · A" active={tool === "add"} onClick={() => pickTool("add")} />
      <RailButton icon="connect" hint="C" title="Connect — handles stay visible · C" active={tool === "connect"} onClick={() => pickTool("connect")} />
      <RailButton icon="container" hint="B" title="Add a container · B" active={tool === "container"} onClick={() => pickTool("container")} />
      <RailButton icon="section" hint="S" title="Sections · S" active={tool === "section"} onClick={() => pickTool("section")} />
      <Sep />
      <RailButton icon="trace" hint="T" title="Trace a request — then click a node · T" active={tool === "trace"} onClick={() => pickTool("trace")} />
      <RailButton icon="layout" hint="L" title="Auto-layout by role · L" onClick={applyAutoLayout} />
      <RailButton icon="cards" hint="K" title="Card view · K" active={cardsForced} onClick={() => setCardsForced(!cardsForced)} />
      <Sep />
      <RailButton icon="samples" title="Templates — load a seeded architecture" active={templatesOpen} onClick={() => setTemplatesOpen(!templatesOpen)} />
      <div className="flex-1" />
      <RailButton icon="grid" hint="⇧G" title="Grid · ⇧G" active={gridOn} onClick={() => setGridOn(!gridOn)} />
      <RailButton icon="undo" hint="⌘Z" title="Undo · ⌘Z" onClick={() => undo()} />
      <RailButton icon="redo" hint="⇧⌘Z" title="Redo · ⇧⌘Z" onClick={() => redo()} />
    </nav>
  );
}
