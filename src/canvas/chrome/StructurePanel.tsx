"use client";

// The layer tree: containment as one indented list with a disclosure
// triangle per frame (folds the tree, not the canvas), a per-type icon, and
// click-to-select for frames and resources alike. Sections — the user's own
// grouping — are listed beneath, visibly different.

import { useMemo, useState } from "react";
import { useStore, pricingOf, snapshotOf } from "@/store/useStore";
import { KIND_META, containerStats, type Container } from "@/engine/containers";
import { getService } from "@/engine/services";
import { Icon } from "../Icon";

interface Row {
  id: string;
  kind: "container" | "node";
  depth: number;
  icon?: string;
  color?: string;
  label: string;
  sub?: string;
  meta?: string;
  collapsed?: boolean;
  hasChildren?: boolean;
}

export function StructurePanel() {
  const nodes = useStore((s) => s.nodes);
  const containers = useStore((s) => s.containers);
  const sections = useStore((s) => s.sections);
  const costOn = useStore((s) => s.layers.cost);
  const traffic = useStore((s) => s.traffic);
  const region = useStore((s) => s.region);
  const selectedId = useStore((s) => s.selectedId);
  const select = useStore((s) => s.select);
  const setContainerCollapsed = useStore((s) => s.setContainerCollapsed);
  const addSection = useStore((s) => s.addSection);
  const removeSection = useStore((s) => s.removeSection);
  const removeContainer = useStore((s) => s.removeContainer);
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

  const rows = useMemo(() => {
    const out: Row[] = [];
    const walk = (parent: string | undefined, depth: number) => {
      for (const c of containers.filter((x) => x.parent === parent)) {
        const meta = KIND_META[c.kind];
        const stat = stats.get(c.id);
        const kids = containers.some((x) => x.parent === c.id) || nodes.some((n) => n.container === c.id);
        out.push({
          id: c.id,
          kind: "container",
          depth,
          icon: meta.icon ?? undefined,
          color: meta.color,
          label: c.name,
          sub: meta.label,
          meta: costOn ? `$${(stat?.monthly ?? 0).toFixed(0)}` : String(stat?.resources ?? 0),
          collapsed: c.collapsed,
          hasChildren: kids,
        });
        if (!folded.has(c.id)) {
          walk(c.id, depth + 1);
          for (const n of nodes.filter((x) => x.container === c.id)) {
            out.push({ id: n.id, kind: "node", depth: depth + 1, icon: getService(n.service)?.icon, label: n.name });
          }
        }
      }
    };
    walk(undefined, 0);
    for (const n of nodes.filter((x) => !x.container)) {
      out.push({ id: n.id, kind: "node", depth: 0, icon: getService(n.service)?.icon, label: n.name });
    }
    return out;
  }, [containers, nodes, stats, costOn, folded]);

  const toggleFold = (id: string) =>
    setFolded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const Header = ({ children, add }: { children: React.ReactNode; add?: () => void }) => (
    <div className="flex items-center justify-between px-[11px] pb-[5px] pt-[9px] text-[9px] uppercase tracking-[0.13em]" style={{ color: "var(--ink-4)" }}>
      {children}
      {add ? (
        <button className="text-[13px] text-ink-3 hover:text-ink-2" onClick={add} title="Add a section from the current selection">
          +
        </button>
      ) : null}
    </div>
  );

  return (
    <div>
      <Header>Containment · {nodes.length} resources</Header>
      {rows.length === 0 ? (
        <p className="px-[11px] pb-2 text-[10.5px]" style={{ color: "var(--ink-4)" }}>
          Nothing yet — press A to add a service, or open Templates from the rail.
        </p>
      ) : null}
      {rows.map((r) => (
        <div
          key={`${r.kind}:${r.id}`}
          className="group flex cursor-pointer items-center gap-[5px] py-[3px] pr-2.5 text-[11.5px] hover:bg-[var(--hover)]"
          style={{ paddingLeft: 6 + r.depth * 13, background: selectedId === r.id ? "var(--accent-bg)" : undefined }}
          onClick={() => select(r.id)}
          title={r.kind === "container" ? `${r.sub} — click to select, double-click to ${r.collapsed ? "expand" : "collapse"} on the canvas` : "Click to select"}
          onDoubleClick={() => {
            if (r.kind === "container") setContainerCollapsed(r.id, !r.collapsed);
          }}
        >
          {r.kind === "container" ? (
            <button
              className="grid h-4 w-4 flex-none place-items-center rounded"
              style={{ color: r.hasChildren ? "var(--ink-3)" : "transparent", transform: folded.has(r.id) ? undefined : "rotate(90deg)" }}
              onClick={(e) => {
                e.stopPropagation();
                if (r.hasChildren) toggleFold(r.id);
              }}
              aria-label={folded.has(r.id) ? "Expand" : "Fold"}
              tabIndex={r.hasChildren ? 0 : -1}
            >
              <Icon name="chevronRight" size={10} />
            </button>
          ) : (
            <span className="w-4 flex-none" />
          )}
          {r.icon ? (
            <svg width="15" height="15" className="flex-none">
              <use href={`#${r.icon}`} width="15" height="15" />
            </svg>
          ) : (
            <span className="mx-1 h-2 w-2 flex-none rounded-sm" style={{ background: r.color }} />
          )}
          <span className="truncate" style={{ color: r.kind === "container" ? "var(--ink-15)" : "var(--ink-2)" }}>
            {r.label}
          </span>
          {r.meta ? (
            <span className="ml-auto text-[9.5px]" style={{ fontFamily: "var(--font-mono-jb)", color: "var(--ink-4)" }}>
              {r.meta}
            </span>
          ) : null}
          {r.kind === "container" ? (
            <>
              <button
                className="pl-[5px] text-[11px] opacity-0 group-hover:opacity-100"
                style={{ fontFamily: "var(--font-mono-jb)", color: r.collapsed ? "var(--accent-ink)" : "var(--ink-4)" }}
                title={r.collapsed ? "Expand on the canvas" : "Collapse to a card on the canvas"}
                onClick={(e) => {
                  e.stopPropagation();
                  setContainerCollapsed(r.id, !r.collapsed);
                }}
              >
                {r.collapsed ? "⤢" : "⤡"}
              </button>
              <button
                className="ml-1 hidden text-[11px] text-ink-4 hover:text-bad group-hover:block"
                title="Remove container — contents move up a level"
                onClick={(e) => {
                  e.stopPropagation();
                  removeContainer(r.id);
                }}
              >
                ×
              </button>
            </>
          ) : null}
        </div>
      ))}

      <Header
        add={() => {
          const sel = useStore.getState().selectedId;
          const isNode = useStore.getState().nodes.some((n) => n.id === sel);
          addSection(`Section ${sections.length + 1}`, sel && isNode ? [sel] : []);
        }}
      >
        Sections
      </Header>
      {sections.length === 0 ? (
        <p className="px-[11px] pb-2 text-[10.5px]" style={{ color: "var(--ink-4)" }}>
          Your own grouping — crosses containers freely.
        </p>
      ) : (
        sections.map((s) => (
          <div
            key={s.id}
            className="group flex cursor-pointer items-center gap-[7px] py-[3px] pl-2 pr-2.5 text-[11.5px] hover:bg-[var(--hover)]"
            title={s.nodeIds.length ? "Click to select its first member" : "Empty — drag its chip on the canvas"}
            onClick={() => {
              if (s.nodeIds[0]) select(s.nodeIds[0]);
            }}
          >
            <span className="mx-1 h-2 w-2 flex-none rounded-sm" style={{ background: s.color }} />
            <span className="truncate" style={{ color: "var(--ink-15)" }}>
              {s.name}
            </span>
            <span className="ml-auto text-[9.5px]" style={{ fontFamily: "var(--font-mono-jb)", color: "var(--ink-4)" }}>
              {s.nodeIds.length}
            </span>
            <button
              className="hidden text-[11px] text-ink-4 hover:text-bad group-hover:block"
              title="Remove section"
              onClick={(e) => {
                e.stopPropagation();
                removeSection(s.id);
              }}
            >
              ×
            </button>
          </div>
        ))
      )}
    </div>
  );
}

/** Kept exported so a future Container type import doesn't drift. */
export type { Container };
