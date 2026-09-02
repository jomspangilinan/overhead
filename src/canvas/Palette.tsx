"use client";

// The Add tab: a sticky search (rendered by the Dock), the ten services with
// their names, and the container kinds — real buttons that create, with the
// validator's own verdict as the tooltip when a kind can't go where the
// selection is.

import { useMemo } from "react";
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

export function PaletteSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label
      className="mx-2.5 my-2 flex items-center gap-2 rounded-lg px-[9px] py-1.5 text-[11.5px]"
      style={{ background: "var(--panel-2)", border: "1px solid var(--line)", color: "var(--ink-4)" }}
    >
      <Icon name="search" size={13} />
      <input
        id="palette-search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search services"
        className="w-full bg-transparent outline-none"
        style={{ color: "var(--ink-2)" }}
      />
      <kbd
        className="rounded px-1 text-[9px]"
        style={{ fontFamily: "var(--font-mono-jb)", border: "1px solid var(--line-2)" }}
      >
        /
      </kbd>
    </label>
  );
}

function Caption({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="col-span-full px-[3px] pb-[3px] pt-2 text-[9px] uppercase tracking-[0.13em]"
      style={{ color: "var(--ink-4)" }}
    >
      {children}
    </div>
  );
}

export function Palette({ query }: { query: string }) {
  const addNode = useStore((s) => s.addNode);
  const addContainer = useStore((s) => s.addContainer);
  const select = useStore((s) => s.select);
  const count = useStore((s) => s.nodes.length);
  const selectedId = useStore((s) => s.selectedId);
  const nodes = useStore((s) => s.nodes);
  const containers = useStore((s) => s.containers);

  const services = Object.values(SERVICES).filter((def) =>
    query ? def.term.toLowerCase().includes(query.toLowerCase()) : true,
  );

  // A new container goes under the deepest legal ancestor of the selection —
  // the selected node's own container, walking up until the kind fits.
  const parentFor = useMemo(() => {
    const selected = nodes.find((n) => n.id === selectedId);
    const own = selected?.container
      ? containers.find((c) => c.id === selected.container)
      : undefined;
    const chain = own ? [own, ...ancestorsOf(containers, own.id)] : [];
    // otherwise the deepest existing container that can legally hold the kind
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

  return (
    <div className="grid grid-cols-4 gap-0.5 px-2 pb-2.5">
      <Caption>Services</Caption>
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
          onClick={() => select(addNode(def.id, `${def.id}-${count + 1}`))}
        >
          <svg width="26" height="26">
            <use href={`#${def.icon}`} width="26" height="26" />
          </svg>
          <span className="text-center text-[9px] leading-tight" style={{ color: "var(--ink-2)" }}>
            {def.term.replace(/^(AWS|Amazon) /, "")}
          </span>
        </button>
      ))}

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
              if ("error" in res) window.alert(res.error.message);
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
    </div>
  );
}
