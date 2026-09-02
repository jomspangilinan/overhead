"use client";

// The Layers tree: every object is a row in one list · containers (by
// ownership), sections and groups (positionally, under each container
// that holds a member), resources, and the connections. Disclosure
// triangles fold the tree, not the canvas; click selects the object
// itself; hover reveals the row's actions.

import { useMemo, useState } from "react";
import { useStore, pricingOf, snapshotOf } from "@/store/useStore";
import { KIND_META, containerStats } from "@/engine/containers";
import { getService } from "@/engine/services";
import { layerRows, type LayerRow } from "@/engine/layers";
import { Icon } from "../Icon";

function Chip({ color, dashed }: { color: string; dashed?: boolean }) {
  return (
    <span
      className="mx-[3px] h-[9px] w-[9px] flex-none rounded-[2px]"
      style={dashed ? { border: `1.5px dashed ${color}` } : { background: color }}
    />
  );
}

export function LayersPanel() {
  const nodes = useStore((s) => s.nodes);
  const edges = useStore((s) => s.edges);
  const containers = useStore((s) => s.containers);
  const sections = useStore((s) => s.sections);
  const costOn = useStore((s) => s.layers.cost);
  const traffic = useStore((s) => s.traffic);
  const region = useStore((s) => s.region);
  const selectedId = useStore((s) => s.selectedId);
  const selectedEdgeId = useStore((s) => s.selectedEdgeId);
  const select = useStore((s) => s.select);
  const selectEdge = useStore((s) => s.selectEdge);
  const setContainerCollapsed = useStore((s) => s.setContainerCollapsed);
  const addSection = useStore((s) => s.addSection);
  const removeSection = useStore((s) => s.removeSection);
  const removeContainer = useStore((s) => s.removeContainer);
  const removeNode = useStore((s) => s.removeNode);
  const removeEdge = useStore((s) => s.removeEdge);
  const setPalette = useStore((s) => s.setPalette);
  const setTool = useStore((s) => s.setTool);
  const [folded, setFolded] = useState<Set<string>>(() => new Set());

  const stats = useMemo(() => {
    try {
      const s = useStore.getState();
      return containerStats(snapshotOf(s), pricingOf(s));
    } catch {
      return new Map();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, containers, traffic, region]);

  const rows = useMemo(
    () => layerRows({ nodes, edges, containers, sections, traffic }, folded),
    [nodes, edges, containers, sections, traffic, folded],
  );
  const nameOf = (id: string) => nodes.find((n) => n.id === id)?.name ?? id;

  const toggleFold = (key: string) =>
    setFolded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const isSelected = (r: LayerRow) => (r.kind === "edge" ? selectedEdgeId === r.id : r.kind !== "connections" && selectedId === r.id);

  const rowClick = (r: LayerRow) => {
    if (r.kind === "edge") selectEdge(r.id);
    else if (r.kind === "connections") toggleFold(r.key);
    else select(r.id);
  };

  const glyph = (r: LayerRow) => {
    if (r.kind === "container") {
      const meta = KIND_META[r.container.kind];
      return meta.icon ? (
        <svg width="15" height="15" className="flex-none">
          <use href={`#${meta.icon}`} width="15" height="15" />
        </svg>
      ) : (
        <Chip color={meta.color} />
      );
    }
    if (r.kind === "node") {
      const icon = getService(r.node.service)?.icon;
      return icon ? (
        <svg width="15" height="15" className="flex-none">
          <use href={`#${icon}`} width="15" height="15" />
        </svg>
      ) : null;
    }
    if (r.kind === "section") return <Chip color={r.section.color} dashed />;
    if (r.kind === "group")
      return (
        <span className="flex-none" style={{ color: r.section.color }}>
          <Icon name="section" size={13} />
        </span>
      );
    if (r.kind === "connections")
      return (
        <span className="flex-none" style={{ color: "var(--ink-3)" }}>
          <Icon name="connect" size={13} />
        </span>
      );
    return (
      <span className="flex-none" style={{ color: "var(--edge-lab)" }}>
        <Icon name="request" size={12} />
      </span>
    );
  };

  const label = (r: LayerRow) => {
    if (r.kind === "container") return r.container.name;
    if (r.kind === "node") return r.node.name;
    if (r.kind === "section" || r.kind === "group") return r.section.name;
    if (r.kind === "connections") return "Connections";
    if (r.kind !== "edge") return "";
    return r.edge.label ? `${r.edge.label} · ${nameOf(r.edge.from)} → ${nameOf(r.edge.to)}` : `${nameOf(r.edge.from)} → ${nameOf(r.edge.to)}`;
  };

  const meta = (r: LayerRow) => {
    if (r.kind === "container") {
      const stat = stats.get(r.id);
      return costOn ? `$${(stat?.monthly ?? 0).toFixed(0)}` : String(stat?.resources ?? 0);
    }
    if (r.kind === "section" || r.kind === "group") return String(r.section.nodeIds.length);
    if (r.kind === "connections") return String(r.count);
    return null;
  };

  const tip = (r: LayerRow) => {
    if (r.kind === "container") return `${KIND_META[r.container.kind].label} · click to select · double-click to ${r.container.collapsed ? "expand" : "collapse"} on the canvas`;
    if (r.kind === "section") return "Section · click to select it and its members";
    if (r.kind === "group") return "Group (⌘G) · click to select its members · ⇧⌘G ungroups";
    if (r.kind === "connections") return "Every edge on the canvas";
    if (r.kind === "edge") return `${r.edge.kind} connection · click to select`;
    return "Click to select";
  };

  const addSectionFromSelection = () => {
    const st = useStore.getState();
    const members = st.selectedIds.filter((id) => st.nodes.some((n) => n.id === id));
    addSection(`Section ${sections.filter((x) => x.kind !== "group").length + 1}`, members);
  };

  return (
    <div>
      <div className="flex items-center justify-between px-[11px] pb-[5px] pt-[9px] text-[9px] uppercase tracking-[0.13em]" style={{ color: "var(--ink-4)" }}>
        <span>
          {nodes.length} resources · {containers.length} frames · {sections.length} sections
        </span>
        <span className="flex items-center gap-1">
          <button
            className="rounded px-1 text-[12px] leading-none text-ink-3 hover:bg-[var(--hover-2)] hover:text-ink-2"
            data-tip="New section (from the selection)"
            aria-label="New section"
            onClick={addSectionFromSelection}
          >
            <Icon name="section" size={12} />
          </button>
          <button
            className="rounded px-1 text-[12px] leading-none text-ink-3 hover:bg-[var(--hover-2)] hover:text-ink-2"
            data-tip="New container · B"
            aria-label="New container"
            onClick={() => {
              setTool("container");
              setPalette(true);
            }}
          >
            <Icon name="container" size={12} />
          </button>
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="px-[11px] pb-2 text-[10.5px]" style={{ color: "var(--ink-4)" }}>
          Nothing yet · press A to add a service, or open Templates from the top bar.
        </p>
      ) : null}
      {rows.map((r) => {
        const foldable = r.kind !== "node" && r.kind !== "edge" && r.hasChildren;
        const open = !folded.has(r.key);
        return (
          <div
            key={r.key}
            className="group flex cursor-pointer items-center gap-[5px] py-[3px] pr-2.5 text-[11.5px] hover:bg-[var(--hover)]"
            style={{
              paddingLeft: 6 + r.depth * 13,
              background: isSelected(r) ? "var(--accent-bg)" : undefined,
              marginTop: r.kind === "connections" ? 6 : undefined,
              borderTop: r.kind === "connections" ? "1px solid var(--line)" : undefined,
            }}
            onClick={() => rowClick(r)}
            title={tip(r)}
            onDoubleClick={() => {
              if (r.kind === "container") setContainerCollapsed(r.id, !r.container.collapsed);
            }}
          >
            <button
              className="grid h-4 w-4 flex-none place-items-center rounded"
              style={{ color: foldable ? "var(--ink-3)" : "transparent", transform: open ? "rotate(90deg)" : undefined }}
              onClick={(e) => {
                e.stopPropagation();
                if (foldable) toggleFold(r.key);
              }}
              aria-label={open ? "Fold" : "Expand"}
              tabIndex={foldable ? 0 : -1}
            >
              <Icon name="chevronRight" size={10} />
            </button>
            {glyph(r)}
            <span
              className="truncate"
              style={{
                color: r.kind === "container" || r.kind === "section" || r.kind === "group" ? "var(--ink-15)" : r.kind === "edge" ? "var(--ink-3)" : "var(--ink-2)",
                fontWeight: r.kind === "connections" ? 600 : undefined,
              }}
            >
              {label(r)}
            </span>
            {meta(r) ? (
              <span className="ml-auto text-[9.5px]" style={{ fontFamily: "var(--font-mono-jb)", color: "var(--ink-4)" }}>
                {meta(r)}
              </span>
            ) : (
              <span className="ml-auto" />
            )}
            {r.kind === "container" ? (
              <button
                className="pl-[5px] text-[11px] opacity-0 group-hover:opacity-100"
                style={{ fontFamily: "var(--font-mono-jb)", color: r.container.collapsed ? "var(--accent-ink)" : "var(--ink-4)" }}
                title={r.container.collapsed ? "Expand on the canvas" : "Collapse to a card on the canvas"}
                onClick={(e) => {
                  e.stopPropagation();
                  setContainerCollapsed(r.id, !r.container.collapsed);
                }}
              >
                {r.container.collapsed ? "⤢" : "⤡"}
              </button>
            ) : null}
            {r.kind !== "connections" ? (
              <button
                className="ml-1 hidden text-[11px] text-ink-4 hover:text-bad group-hover:block"
                title={
                  r.kind === "container"
                    ? "Remove container · contents move up a level"
                    : r.kind === "section" || r.kind === "group"
                      ? "Remove · members stay on the canvas"
                      : r.kind === "edge"
                        ? "Remove connection"
                        : "Remove resource"
                }
                onClick={(e) => {
                  e.stopPropagation();
                  if (r.kind === "container") removeContainer(r.id);
                  else if (r.kind === "section" || r.kind === "group") removeSection(r.id);
                  else if (r.kind === "edge") removeEdge(r.id);
                  else removeNode(r.id);
                }}
              >
                ×
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
