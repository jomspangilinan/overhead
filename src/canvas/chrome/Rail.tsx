"use client";

// The 52px tool rail. Icons with a keyboard hint — never a row of labelled
// pill buttons. Active state is --accent-bg plus a tick that bleeds out the
// rail's left edge.

import { useStore, type Tool } from "@/store/useStore";
import { undo } from "@/store/history";
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
      className="relative grid h-9 w-9 place-items-center rounded-[10px] transition-colors"
      style={{
        background: active ? "var(--accent-bg)" : undefined,
        color: active ? "var(--accent-ink)" : "var(--ink-3)",
      }}
    >
      {active ? (
        <span
          aria-hidden
          className="absolute rounded-sm"
          style={{
            left: -8,
            top: 9,
            width: 2.5,
            height: 18,
            background: "var(--accent)",
          }}
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

const Sep = () => (
  <div className="my-[5px] h-px w-5" style={{ background: "var(--line)" }} />
);

export function Rail() {
  const tool = useStore((s) => s.tool);
  const setTool = useStore((s) => s.setTool);
  const gridOn = useStore((s) => s.gridOn);
  const setGridOn = useStore((s) => s.setGridOn);

  const pick = (t: Tool) => () => setTool(tool === t ? "select" : t);

  return (
    <nav
      className="fixed z-[8] flex w-[52px] flex-col items-center gap-[3px] rounded-[15px] py-2"
      style={{
        left: 16,
        top: 16,
        bottom: 16,
        background: "var(--panel)",
        border: "1px solid var(--line)",
      }}
    >
      <RailButton
        icon="select"
        hint="V"
        title="Select · V"
        active={tool === "select"}
        onClick={() => setTool("select")}
      />
      <RailButton
        icon="pan"
        hint="H"
        title="Pan · H"
        active={tool === "pan"}
        onClick={() => setTool("pan")}
      />
      <Sep />
      <RailButton
        icon="plus"
        hint="A"
        title="Add service · A"
        active={tool === "add"}
        onClick={pick("add")}
      />
      <RailButton
        icon="connect"
        hint="C"
        title="Connect · C"
        active={tool === "connect"}
        onClick={pick("connect")}
      />
      <RailButton
        icon="container"
        hint="B"
        title="Container — cloud, region, VPC, subnet · B"
        active={tool === "container"}
        onClick={pick("container")}
      />
      <RailButton
        icon="section"
        hint="S"
        title="Section — your own grouping · S"
        active={tool === "section"}
        onClick={pick("section")}
      />
      <Sep />
      <RailButton
        icon="trace"
        hint="T"
        title="Trace a request · T"
        active={tool === "trace"}
        onClick={pick("trace")}
      />
      <div className="flex-1" />
      <RailButton
        icon="grid"
        title="Grid · ⇧G"
        active={gridOn}
        onClick={() => setGridOn(!gridOn)}
      />
      <RailButton icon="undo" title="Undo · ⌘Z" onClick={() => undo()} />
    </nav>
  );
}
