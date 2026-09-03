"use client";

// The Layers tree: every object is a row in one list · containers (by
// ownership), sections and groups (positionally, under each container
// that holds a member), resources, and the connections. Disclosure
// triangles fold the tree, not the canvas; the top level is an accordion
// between Connections and everything else (Connections starts folded).
// Click selects the object itself; hover reveals the row's actions; drag
// a row onto another to move it there (a resource into a frame or a
// section, a frame into a frame, a resource after another to reorder),
// or onto the header line to send it to the top level.

import { useMemo, useState } from "react";
import { useStore, pricingOf, snapshotOf } from "@/store/useStore";
import { KIND_META, containerStats } from "@/engine/containers";
import { getService } from "@/engine/services";
import { sectionMembersDeep } from "@/engine/layers";
import { layerRows, type LayerRow } from "@/engine/layers";
import { Icon } from "../Icon";

const MIME = "application/overhead-layer";
type Dragged = { kind: "node" | "container" | "section" | "group"; id: string };
/** Where the pointer sits over a row: the top and bottom quarters insert
 *  beside it (taking that row's own parents), the middle drops inside. */
type Where = "before" | "inside" | "after";

function whereIn(e: React.DragEvent, el: HTMLElement, canNest: boolean): Where {
  const r = el.getBoundingClientRect();
  const t = (e.clientY - r.top) / r.height;
  if (!canNest) return t < 0.5 ? "before" : "after";
  return t < 0.28 ? "before" : t > 0.72 ? "after" : "inside";
}

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
  const removeSection = useStore((s) => s.removeSection);
  const removeContainer = useStore((s) => s.removeContainer);
  const removeNode = useStore((s) => s.removeNode);
  const removeEdge = useStore((s) => s.removeEdge);
  const moveIntoContainer = useStore((s) => s.moveIntoContainer);
  const setContainerParent = useStore((s) => s.setContainerParent);
  const setSectionNodes = useStore((s) => s.setSectionNodes);
  const setSectionParent = useStore((s) => s.setSectionParent);
  const setSectionCollapsed = useStore((s) => s.setSectionCollapsed);
  const placeNodeBeside = useStore((s) => s.placeNodeBeside);
  const notify = useStore((s) => s.notify);
  const [folded, setFolded] = useState<Set<string>>(() => new Set(["/connections"]));
  const [over, setOver] = useState<{ key: string; where: Where } | null>(null);

  const stats = useMemo(() => {
    try {
      const s = useStore.getState();
      return containerStats(snapshotOf(s), pricingOf(s));
    } catch {
      return new Map();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, containers, traffic, region]);

  const all = useMemo(
    () => layerRows({ nodes, edges, containers, sections, traffic }, folded),
    [nodes, edges, containers, sections, traffic, folded],
  );
  // One at a time, literally: with Connections open the panel shows the
  // connections and nothing else. Folding only the *foldable* top-level rows
  // was not an accordion at all on a drawing with no frames · every resource
  // is a leaf there, so opening Connections folded nothing and you got both
  // lists at once, which is what the rule existed to prevent. Clicking
  // Connections again brings the objects back, and the header line above
  // keeps counting them either way.
  const rows = useMemo(
    () =>
      folded.has("/connections")
        ? all
        : all.filter((r) => r.kind === "connections" || r.kind === "edge"),
    [all, folded],
  );
  const nameOf = (id: string) => nodes.find((n) => n.id === id)?.name ?? id;
  const isTop = (key: string) => key.split("/").length === 2;

  // Accordion at the top level: opening Connections folds every other
  // top-level row; opening any top-level object folds Connections.
  const toggleFold = (key: string) =>
    setFolded((prev) => {
      const next = new Set(prev);
      if (!next.has(key)) {
        next.add(key);
        return next;
      }
      next.delete(key);
      if (key === "/connections") {
        for (const r of all) if (r.depth === 0 && r.key !== key) next.add(r.key);
      } else if (isTop(key)) next.add("/connections");
      return next;
    });

  const isSelected = (r: LayerRow) => (r.kind === "edge" ? selectedEdgeId === r.id : r.kind !== "connections" && selectedId === r.id);

  const rowClick = (r: LayerRow) => {
    if (r.kind === "edge") selectEdge(r.id);
    else if (r.kind === "connections") toggleFold(r.key);
    else select(r.id);
  };

  // ---- drag a row onto another ----
  const draggable = (r: LayerRow): r is Extract<LayerRow, { kind: Dragged["kind"] }> =>
    r.kind === "node" || r.kind === "container" || r.kind === "section" || r.kind === "group";
  const readDrag = (e: React.DragEvent): Dragged | null => {
    try {
      const raw = e.dataTransfer.getData(MIME);
      return raw ? (JSON.parse(raw) as Dragged) : null;
    } catch {
      return null;
    }
  };
  const report = (res: { error: { message: string } } | object) => {
    if ("error" in res) notify(res.error.message, "warn");
  };
  /** Drop `d` beside `target`: it adopts that row's own frame and section,
   *  which is how a row moves *out* of one (drop it beside a shallower
   *  row, or on the header line for the top level). */
  const dropBeside = (d: Dragged, target: LayerRow, where: "before" | "after") => {
    if (target.id === d.id) return;
    const ctx = target.ctx;
    if (d.kind === "node") {
      const node = nodes.find((n) => n.id === d.id);
      if (!node) return;
      if ((node.container ?? undefined) !== ctx.container) report(moveIntoContainer([d.id], ctx.container ?? null));
      for (const s of sections) {
        if (s.kind === "group") continue;
        const member = s.nodeIds.includes(d.id);
        if (member && s.id !== ctx.section) setSectionNodes(s.id, s.nodeIds.filter((id) => id !== d.id));
        if (!member && s.id === ctx.section) setSectionNodes(s.id, [...s.nodeIds, d.id]);
      }
      if (target.kind === "node") placeNodeBeside(d.id, target.id, where);
    } else if (d.kind === "container") {
      report(setContainerParent(d.id, ctx.container));
    } else {
      setSectionParent(d.id, ctx.section);
    }
    notify(ctx.section ? "Moved beside · same section" : ctx.container ? "Moved beside · same frame" : "Moved to the top level");
  };

  /** Drop `d` *into* `target` (null = the top level). */
  const dropOn = (d: Dragged, target: LayerRow | null) => {
    if (target && target.id === d.id) return;
    if (!target) {
      if (d.kind === "node") {
        report(moveIntoContainer([d.id], null));
        for (const s of sections) if (s.kind !== "group" && s.nodeIds.includes(d.id)) setSectionNodes(s.id, s.nodeIds.filter((id) => id !== d.id));
      } else if (d.kind === "container") report(setContainerParent(d.id, undefined));
      else setSectionParent(d.id, undefined);
      notify("Moved to the top level");
      return;
    }
    if (target.kind === "container") {
      if (d.kind === "node") report(moveIntoContainer([d.id], target.id));
      else if (d.kind === "container") report(setContainerParent(d.id, target.id));
      else report(moveIntoContainer(sectionMembersDeep(sections, d.id), target.id));
      notify(`Moved into ${target.container.name}`);
      return;
    }
    if (target.kind === "section" || target.kind === "group") {
      if (d.kind === "node") {
        if (!target.section.nodeIds.includes(d.id)) setSectionNodes(target.id, [...target.section.nodeIds, d.id]);
      } else if (d.kind === "section" || d.kind === "group") setSectionParent(d.id, target.id);
      else return;
      notify(`Moved into ${target.section.name}`);
    }
  };
  const dropTarget = (r: LayerRow) => r.kind === "container" || r.kind === "section" || r.kind === "group" || r.kind === "node";
  /** Only a frame or a section can take a row inside it. */
  const canNest = (r: LayerRow) => r.kind === "container" || r.kind === "section" || r.kind === "group";

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
    if (r.kind === "container") return `${KIND_META[r.container.kind].label} · click to select · double-click to ${r.container.collapsed ? "expand" : "collapse"} on the canvas · drop a row here to move it in`;
    if (r.kind === "section") return "Section · click to select it and its members · drop a resource here to add it";
    if (r.kind === "group") return "Group (⌘G) · click to select its members · ⇧⌘G ungroups";
    if (r.kind === "connections") return "Every edge on the canvas";
    if (r.kind === "edge") return `${r.edge.kind} connection · click to select`;
    return "Click to select · drag onto a frame or section to move it there";
  };

  return (
    <div>
      <div
        className="flex items-center justify-between px-[11px] pb-[5px] pt-[9px] text-[9px] uppercase tracking-[0.13em]"
        style={{ color: over?.key === "/" ? "var(--accent-ink)" : "var(--ink-4)", background: over?.key === "/" ? "var(--accent-bg)" : undefined }}
        title="Drop a row here to send it to the top level"
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes(MIME)) return;
          e.preventDefault();
          setOver({ key: "/", where: "inside" });
        }}
        onDragLeave={() => setOver(null)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(null);
          const d = readDrag(e);
          if (d) dropOn(d, null);
        }}
      >
        <span>
          {over?.key === "/" ? "Drop here · top level" : `${nodes.length} resources · ${containers.length} frames · ${sections.length} sections`}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="px-[11px] pb-2 text-[10.5px]" style={{ color: "var(--ink-4)" }}>
          Nothing yet · press A to add a service, or open Import for a seeded template.
        </p>
      ) : null}
      {rows.map((r) => {
        const foldable = r.kind !== "node" && r.kind !== "edge" && r.hasChildren;
        const open = !folded.has(r.key);
        const where = over?.key === r.key ? over.where : null;
        const line = `inset 0 ${where === "before" ? "2px" : "-2px"} 0 0 var(--accent)`;
        return (
          <div
            key={r.key}
            className="group relative flex cursor-pointer items-center gap-[5px] py-[3px] pr-2.5 text-[11.5px] hover:bg-[var(--hover)]"
            style={{
              paddingLeft: 6 + r.depth * 13,
              background: where === "inside" ? "var(--accent-bg)" : isSelected(r) ? "var(--accent-bg)" : undefined,
              boxShadow: where === "inside" ? "inset 0 0 0 1px var(--accent)" : where ? line : undefined,
              marginTop: r.kind === "connections" ? 6 : undefined,
              borderTop: r.kind === "connections" ? "1px solid var(--line)" : undefined,
            }}
            onClick={() => rowClick(r)}
            title={tip(r)}
            onDoubleClick={() => {
              if (r.kind === "container") setContainerCollapsed(r.id, !r.container.collapsed);
              else if (r.kind === "section") setSectionCollapsed(r.id, !r.section.collapsed);
            }}
            draggable={draggable(r)}
            onDragStart={(e) => {
              if (!draggable(r)) return;
              e.dataTransfer.setData(MIME, JSON.stringify({ kind: r.kind, id: r.id } satisfies Dragged));
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => {
              if (!dropTarget(r) || !e.dataTransfer.types.includes(MIME)) return;
              e.preventDefault();
              e.stopPropagation();
              const w = whereIn(e, e.currentTarget, canNest(r));
              if (over?.key !== r.key || over.where !== w) setOver({ key: r.key, where: w });
            }}
            onDragLeave={() => {
              if (over?.key === r.key) setOver(null);
            }}
            onDrop={(e) => {
              if (!dropTarget(r)) return;
              e.preventDefault();
              e.stopPropagation();
              const w = whereIn(e, e.currentTarget, canNest(r));
              setOver(null);
              const d = readDrag(e);
              if (!d) return;
              if (w === "inside") dropOn(d, r);
              else dropBeside(d, r, w);
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
            {r.kind === "container" || r.kind === "section" ? (
              (() => {
                const collapsed = r.kind === "container" ? r.container.collapsed : r.section.collapsed;
                return (
                  <button
                    className="pl-[5px] text-[11px] opacity-0 group-hover:opacity-100"
                    style={{ fontFamily: "var(--font-mono-jb)", color: collapsed ? "var(--accent-ink)" : "var(--ink-4)" }}
                    title={collapsed ? "Expand on the canvas" : "Collapse to a card on the canvas"}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (r.kind === "container") setContainerCollapsed(r.id, !collapsed);
                      else setSectionCollapsed(r.id, !collapsed);
                    }}
                  >
                    {collapsed ? "⤢" : "⤡"}
                  </button>
                );
              })()
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
