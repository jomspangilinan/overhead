"use client";

// The containment tree, with the user's sections listed beneath it — the
// two grouping systems side by side and visibly different.

import { useMemo } from "react";
import { useStore, pricingOf, snapshotOf } from "@/store/useStore";
import { KIND_META, containerStats, type Container } from "@/engine/containers";
import { getService } from "@/engine/services";

interface Row {
  id: string;
  kind: "container" | "node";
  depth: number;
  icon?: string;
  color?: string;
  label: string;
  meta?: string;
  collapsed?: boolean;
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
      // sub-containers first, then the resources at this level
      for (const c of containers.filter((x) => x.parent === parent)) {
        const meta = KIND_META[c.kind];
        const stat = stats.get(c.id);
        out.push({
          id: c.id,
          kind: "container",
          depth,
          icon: meta.icon ?? undefined,
          color: meta.color,
          label: c.name,
          meta: costOn
            ? `$${(stat?.monthly ?? 0).toFixed(0)}`
            : String(stat?.resources ?? 0),
          collapsed: c.collapsed,
        });
        if (!c.collapsed) {
          walk(c.id, depth + 1);
          for (const n of nodes.filter((x) => x.container === c.id)) {
            out.push({
              id: n.id,
              kind: "node",
              depth: depth + 1,
              icon: getService(n.service)?.icon,
              label: n.name,
            });
          }
        }
      }
    };
    walk(undefined, 0);
    // anything not in a container sits at the root
    for (const n of nodes.filter((x) => !x.container)) {
      out.push({
        id: n.id,
        kind: "node",
        depth: 0,
        icon: getService(n.service)?.icon,
        label: n.name,
      });
    }
    return out;
  }, [containers, nodes, stats, costOn]);

  const Header = ({
    children,
    add,
  }: {
    children: React.ReactNode;
    add?: () => void;
  }) => (
    <div
      className="flex items-center justify-between px-[11px] pb-[5px] pt-[9px] text-[9px] uppercase tracking-[0.13em]"
      style={{ color: "var(--ink-4)" }}
    >
      {children}
      {add ? (
        <button
          className="text-[13px] text-ink-3 hover:text-ink-2"
          onClick={add}
          title="Add a section from the current selection"
        >
          +
        </button>
      ) : null}
    </div>
  );

  return (
    <div>
      <Header>Structure · {nodes.length} resources</Header>
      {rows.map((r) => (
        <div
          key={`${r.kind}:${r.id}`}
          className="group flex cursor-pointer items-center gap-[7px] py-1 pr-2.5 text-[11.5px] hover:bg-[var(--hover)]"
          style={{
            paddingLeft: 8 + r.depth * 13,
            background: selectedId === r.id ? "var(--accent-bg)" : undefined,
          }}
          onClick={() =>
            r.kind === "node"
              ? select(r.id)
              : setContainerCollapsed(r.id, !r.collapsed)
          }
        >
          {r.icon ? (
            <svg width="16" height="16" className="flex-none">
              <use href={`#${r.icon}`} width="16" height="16" />
            </svg>
          ) : (
            <span
              className="mx-1 h-2 w-2 flex-none rounded-sm"
              style={{ background: r.color }}
            />
          )}
          <span className="truncate" style={{ color: "var(--ink-15)" }}>
            {r.label}
          </span>
          {r.meta ? (
            <span
              className="ml-auto text-[9.5px]"
              style={{ fontFamily: "var(--font-mono-jb)", color: "var(--ink-4)" }}
            >
              {r.meta}
            </span>
          ) : null}
          {r.kind === "container" ? (
            <>
              <span
                className="pl-[5px] text-[11px]"
                style={{ fontFamily: "var(--font-mono-jb)", color: "var(--ink-4)" }}
              >
                {r.collapsed ? "⤢" : "⤡"}
              </span>
              <button
                className="ml-1 hidden text-[11px] text-ink-4 hover:text-bad group-hover:block"
                title="Remove container — contents move up a level"
                onClick={(e) => { e.stopPropagation(); removeContainer(r.id); }}
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
          addSection(
            `Section ${sections.length + 1}`,
            sel ? [sel] : [],
          );
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
            className="group flex cursor-pointer items-center gap-[7px] py-1 pl-2 pr-2.5 text-[11.5px] hover:bg-[var(--hover)]"
            title={s.nodeIds.length ? "Click to select its first member" : "Empty — drag its chip on the canvas"}
            onClick={() => { if (s.nodeIds[0]) select(s.nodeIds[0]); }}
          >
            <span
              className="mx-1 h-2 w-2 flex-none rounded-sm"
              style={{ background: s.color }}
            />
            <span className="truncate" style={{ color: "var(--ink-15)" }}>
              {s.name}
            </span>
            <span
              className="ml-auto text-[9.5px]"
              style={{ fontFamily: "var(--font-mono-jb)", color: "var(--ink-4)" }}
            >
              {s.nodeIds.length}
            </span>
            <button
              className="hidden text-[11px] text-ink-4 hover:text-bad group-hover:block"
              title="Remove section"
              onClick={(e) => { e.stopPropagation(); removeSection(s.id); }}
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
