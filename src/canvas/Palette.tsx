"use client";

// The Add palette: a floating, searchable panel above the toolbar (A, or /),
// not a dock tab competing with the layer tree. Services add on click or
// drag onto the canvas; container kinds are real buttons that create, with
// the validator's own verdict as the tooltip when a kind can't go where the
// selection is.

import { useEffect, useMemo, useRef, useState } from "react";
import { SERVICES } from "@/engine/services";
import { useStore } from "@/store/useStore";
import {
  KIND_META,
  CONTAINER_KINDS,
  ancestorsOf,
  validateContainerParent,
  type ContainerKind,
} from "@/engine/containers";
import { Icon } from "./Icon";

function Caption({ children }: { children: React.ReactNode }) {
  return (
    <div className="col-span-full px-[3px] pb-[3px] pt-2 text-[9px] uppercase tracking-[0.13em]" style={{ color: "var(--ink-4)" }}>
      {children}
    </div>
  );
}

export function closePalette() {
  const s = useStore.getState();
  s.setPalette(false);
  if (s.tool === "add" || s.tool === "container") s.setTool("select");
}

export function PaletteFloat() {
  const open = useStore((s) => s.palette);
  const tool = useStore((s) => s.tool);
  const addNode = useStore((s) => s.addNode);
  const addContainer = useStore((s) => s.addContainer);
  const select = useStore((s) => s.select);
  const notify = useStore((s) => s.notify);
  const count = useStore((s) => s.nodes.length);
  const selectedId = useStore((s) => s.selectedId);
  const nodes = useStore((s) => s.nodes);
  const containers = useStore((s) => s.containers);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  // click outside closes; the toolbar's own buttons toggle it themselves
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (ref.current?.contains(t) || t.closest(".oh-toolbar")) return;
      closePalette();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  useEffect(() => {
    if (open) requestAnimationFrame(() => document.getElementById("palette-search")?.focus());
    else setQuery("");
  }, [open]);

  const services = Object.values(SERVICES).filter((def) =>
    query ? def.term.toLowerCase().includes(query.toLowerCase()) || def.id.includes(query.toLowerCase()) : true,
  );

  // A new container goes under the deepest legal ancestor of the selection —
  // a selected frame itself, or the selected node's container, walking up
  // until the kind fits; otherwise the deepest existing legal container.
  const parentFor = useMemo(() => {
    const selectedC = containers.find((c) => c.id === selectedId);
    const selectedN = nodes.find((n) => n.id === selectedId);
    const own = selectedC ?? (selectedN?.container ? containers.find((c) => c.id === selectedN.container) : undefined);
    const chain = own ? [own, ...ancestorsOf(containers, own.id)] : [];
    const fallback = [
      ...containers.filter((c) => c.kind === "subnetpri" || c.kind === "subnetpub"),
      ...containers.filter((c) => c.kind === "vpc"),
      ...containers.filter((c) => c.kind === "region"),
      ...containers.filter((c) => c.kind === "cloud"),
    ];
    return (kind: ContainerKind) => {
      for (const c of [...chain, ...fallback]) {
        if (!validateContainerParent(kind, c.kind)) return c;
      }
      return validateContainerParent(kind, null) ? undefined : null; // null = top level ok
    };
  }, [nodes, containers, selectedId]);

  if (!open) return null;
  const containersFirst = tool === "container";

  const serviceGrid = (
    <>
      <Caption>Services</Caption>
      {services.length === 0 ? (
        <div className="col-span-full px-1 pb-2 text-[11px]" style={{ color: "var(--ink-4)" }}>
          No service matches “{query}”.
        </div>
      ) : null}
      {services.map((def) => (
        <button
          key={def.id}
          title={`${def.term} — click to add, or drag onto the canvas`}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData("application/overhead-service", def.id);
            e.dataTransfer.effectAllowed = "copy";
          }}
          className="flex cursor-grab flex-col items-center gap-1 rounded-[9px] px-1 py-2 hover:bg-[var(--hover)] active:cursor-grabbing"
          onClick={() => {
            const selectedC = containers.find((c) => c.id === selectedId);
            const id = addNode(def.id, `${def.id}-${count + 1}`, undefined, selectedC && (selectedC.kind === "region" || selectedC.kind === "cloud") ? selectedC.id : undefined);
            select(id);
          }}
        >
          <svg width="26" height="26">
            <use href={`#${def.icon}`} width="26" height="26" />
          </svg>
          <span className="text-center text-[9px] leading-tight" style={{ color: "var(--ink-2)" }}>
            {def.term.replace(/^(AWS|Amazon) /, "")}
          </span>
        </button>
      ))}
    </>
  );

  const containerList = (
    <>
      <Caption>Containers</Caption>
      {CONTAINER_KINDS.map((kind) => {
        const meta = KIND_META[kind];
        const parent = parentFor(kind);
        const blocked = parent === undefined;
        const why = blocked
          ? validateContainerParent(kind, null)?.message ?? "No legal parent on this canvas yet."
          : parent
            ? `Adds inside ${parent.name}`
            : "Adds at the top level";
        return (
          <button
            key={kind}
            disabled={blocked}
            title={why}
            className="col-span-full flex items-center gap-[7px] rounded-lg p-1.5 text-left text-[10.5px] hover:bg-[var(--hover)] disabled:cursor-not-allowed disabled:opacity-40"
            style={{ color: "var(--ink-2)" }}
            onClick={() => {
              const n = containers.filter((c) => c.kind === kind).length + 1;
              const res = addContainer(kind, `${meta.label.toLowerCase().replace(" ", "-")}-${n}`, undefined, parent?.id);
              if ("error" in res) notify(res.error.message, "warn");
              else {
                select(res.id);
                notify(parent ? `${meta.label} added inside ${parent.name}` : `${meta.label} added`);
              }
            }}
          >
            {meta.icon ? (
              <svg width="18" height="18" style={{ color: meta.color }}>
                <use href={`#${meta.icon}`} width="18" height="18" />
              </svg>
            ) : (
              <span className="h-3.5 w-3.5 rounded-sm border border-dashed" style={{ borderColor: meta.color }} />
            )}
            {meta.label}
            <span className="ml-auto text-[9px]" style={{ color: "var(--ink-4)" }}>
              {blocked ? "—" : parent ? `in ${parent.name}` : "top"}
            </span>
          </button>
        );
      })}
    </>
  );

  return (
    <div
      ref={ref}
      className="glass absolute z-[8] flex max-h-[calc(100%-90px)] w-[292px] flex-col rounded-xl"
      style={{ left: "50%", bottom: 64, transform: "translateX(-50%)" }}
      role="dialog"
      aria-label="Add"
    >
      <label
        className="mx-2.5 mt-2.5 flex items-center gap-2 rounded-lg px-[9px] py-1.5 text-[11.5px]"
        style={{ background: "var(--panel-2)", border: "1px solid var(--line)", color: "var(--ink-4)" }}
      >
        <Icon name="search" size={13} />
        <input
          id="palette-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search services"
          className="w-full bg-transparent outline-none"
          style={{ color: "var(--ink-2)" }}
          onKeyDown={(e) => {
            if (e.key === "Escape") closePalette();
            if (e.key === "Enter" && services[0]) {
              select(addNode(services[0].id, `${services[0].id}-${count + 1}`));
            }
          }}
        />
        <kbd className="rounded px-1 text-[9px]" style={{ fontFamily: "var(--font-mono-jb)", border: "1px solid var(--line-2)" }}>
          esc
        </kbd>
      </label>
      <div className="grid min-h-0 grid-cols-4 gap-0.5 overflow-auto px-2 pb-2.5">
        {containersFirst ? containerList : serviceGrid}
        {containersFirst ? serviceGrid : containerList}
      </div>
    </div>
  );
}
