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
  TYPICAL_PARENTS,
  type ContainerKind,
} from "@/engine/containers";
import { Icon } from "./Icon";
import { useReactFlow } from "@xyflow/react";
import { frameBoxes } from "@/engine/frames";
import { NODE_W, NODE_H } from "./nodeMetrics";

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
  s.setPendingConnection(null);
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
  const pending = useStore((s) => s.pendingConnection);
  const addEdge = useStore((s) => s.addEdge);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const fromNode = pending ? nodes.find((n) => n.id === pending.fromNodeId) : undefined;
  const { setCenter, getViewport } = useReactFlow();

  // A new frame lands clear of everything, which can be off-screen and
  // look like nothing happened: pan to it when it is out of view.
  const reveal = (id: string) => {
    const st = useStore.getState();
    const box = frameBoxes(st.nodes, st.containers, { nodeW: NODE_W, nodeH: NODE_H }).get(id);
    const host = ref.current?.parentElement;
    if (!box || !host) return;
    const { x, y, zoom } = getViewport();
    const view = { l: -x / zoom, t: -y / zoom, r: (host.clientWidth - x) / zoom, b: (host.clientHeight - y) / zoom };
    const visible = box.l >= view.l && box.r <= view.r && box.t >= view.t && box.b <= view.b;
    if (!visible) void setCenter((box.l + box.r) / 2, (box.t + box.b) / 2, { zoom, duration: 240 });
  };

  // Add a service: beside the pending source and connected to it, else
  // inside the selected region/cloud.
  const place = (serviceId: string) => {
    const name = `${serviceId}-${count + 1}`;
    if (pending && fromNode) {
      const id = addNode(serviceId, name, undefined, fromNode.container, pending.at);
      addEdge(pending.fromNodeId, id, "sync", undefined, { anchors: { from: pending.side } });
      select(id);
      notify(`${name} connected from ${fromNode.name}`);
      closePalette();
      return;
    }
    const selectedC = containers.find((c) => c.id === selectedId);
    select(addNode(serviceId, name, undefined, selectedC && (selectedC.kind === "region" || selectedC.kind === "cloud") ? selectedC.id : undefined));
  };

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

  // Where a new container lands · nothing is ever refused, this only picks
  // a sensible default: the selected frame (or the selected node's) when
  // the kind typically sits there, else the nearest typical ancestor, else
  // the selected frame itself, else the deepest typical frame on the
  // canvas, else the top level (null).
  const parentFor = useMemo(() => {
    const selectedC = containers.find((c) => c.id === selectedId);
    const selectedN = nodes.find((n) => n.id === selectedId);
    const own = selectedC ?? (selectedN?.container ? containers.find((c) => c.id === selectedN.container) : undefined);
    const chain = own ? [own, ...ancestorsOf(containers, own.id)] : [];
    const deepest = [...containers].sort((a, b) => ancestorsOf(containers, b.id).length - ancestorsOf(containers, a.id).length);
    return (kind: ContainerKind): (typeof containers)[number] | null => {
      const typical = TYPICAL_PARENTS[kind];
      return chain.find((c) => typical.includes(c.kind)) ?? own ?? deepest.find((c) => typical.includes(c.kind)) ?? null;
    };
  }, [nodes, containers, selectedId]);

  if (!open) return null;
  const containersFirst = tool === "container" && !pending;
  // Anchored at the pad / drop point when connecting, clamped to the canvas;
  // above the toolbar otherwise.
  const host = ref.current?.parentElement;
  const anchored: React.CSSProperties = pending
    ? {
        left: Math.max(8, Math.min((host?.clientWidth ?? 1200) - 300, pending.screen.x + 12)),
        top: Math.max(8, Math.min((host?.clientHeight ?? 800) - 420, pending.screen.y - 20)),
      }
    : { left: "50%", bottom: 64, transform: "translateX(-50%)" };

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
          title={`${def.term} · click to add, or drag onto the canvas`}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData("application/overhead-service", def.id);
            e.dataTransfer.effectAllowed = "copy";
          }}
          className="flex cursor-grab flex-col items-center gap-1 rounded-[9px] px-1 py-2 hover:bg-[var(--hover)] active:cursor-grabbing"
          onClick={() => place(def.id)}
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
        const why = parent ? `Adds inside ${parent.name} · select a frame first to choose` : "Adds at the top level";
        return (
          <button
            key={kind}
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
                requestAnimationFrame(() => reveal(res.id));
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
              {parent ? `in ${parent.name}` : "top"}
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
      style={anchored}
      role="dialog"
      aria-label={pending ? "Connect from" : "Add"}
    >
      {pending && fromNode ? (
        <div className="mx-2.5 mt-2.5 flex items-center gap-2 rounded-lg px-2 py-1 text-[11px]" style={{ background: "var(--accent-bg)", color: "var(--accent-ink)" }}>
          <Icon name="connect" size={12} />
          Connect from <b>{fromNode.name}</b> · {pending.side}
        </div>
      ) : null}
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
            if (e.key === "Enter" && services[0]) place(services[0].id);
          }}
        />
        <kbd className="rounded px-1 text-[9px]" style={{ fontFamily: "var(--font-mono-jb)", border: "1px solid var(--line-2)" }}>
          esc
        </kbd>
      </label>
      <div className="grid min-h-0 grid-cols-4 gap-0.5 overflow-auto px-2 pb-2.5">
        {containersFirst ? containerList : serviceGrid}
        {pending ? null : containersFirst ? serviceGrid : containerList}
      </div>
    </div>
  );
}
