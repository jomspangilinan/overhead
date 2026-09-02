"use client";

// The properties panel: named, independently collapsible sections bound to
// the selection — the way Figma groups a layer's properties. Settings stay
// generated from the service schema (one vocabulary for the human and the
// agent); Position, Placement, Appearance and Frame are the direct
// manipulation fields for what the canvas also lets you drag.

import { useMemo, useState, type ReactNode } from "react";
import { useStore, pricingOf, snapshotOf } from "@/store/useStore";
import { getService } from "@/engine/services";
import { validateSetting, type SettingDef } from "@/engine/defineService";
import { nodeCost } from "@/engine/cost";
import { findingsForNode } from "@/engine/findings";
import { toMoney, type EdgeStyle } from "@/engine/model";
import {
  KIND_META,
  ancestorsOf,
  breadcrumb,
  containerStats,
  validateNodePlacement,
} from "@/engine/containers";
import { contentBoxes, frameBoxes } from "@/engine/frames";
import { NODE_W, NODE_H } from "./nodeMetrics";
import { Icon } from "./Icon";
import { dashFor, widthFor } from "./TypedEdge";

// ---- section chrome ------------------------------------------------------

const OPEN_KEY = "overhead-inspector-open";
let openState: Record<string, boolean> | null = null;
function readOpen(): Record<string, boolean> {
  if (openState) return openState;
  try {
    openState = JSON.parse(localStorage.getItem(OPEN_KEY) ?? "{}") as Record<string, boolean>;
  } catch {
    openState = {};
  }
  return openState;
}

function Section({
  id,
  title,
  aside,
  defaultOpen = true,
  children,
}: {
  id: string;
  title: string;
  aside?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState<boolean>(() => readOpen()[id] ?? defaultOpen);
  const toggle = () => {
    const next = !open;
    setOpen(next);
    const st = readOpen();
    st[id] = next;
    try {
      localStorage.setItem(OPEN_KEY, JSON.stringify(st));
    } catch {}
  };
  return (
    <section className="oh-section">
      <button
        className="flex w-full items-center gap-1.5 px-3.5 py-2 text-left hover:bg-[var(--hover)]"
        onClick={toggle}
        aria-expanded={open}
      >
        <span
          className="grid h-3.5 w-3.5 place-items-center transition-transform"
          style={{ color: "var(--ink-4)", transform: open ? "rotate(90deg)" : undefined }}
        >
          <Icon name="chevronRight" size={11} />
        </span>
        <span className="lab" style={{ color: "var(--ink-2)" }}>
          {title}
        </span>
        {aside ? <span className="ml-auto text-[10.5px]" style={{ color: "var(--ink-3)", fontFamily: "var(--font-mono-jb)" }}>{aside}</span> : null}
      </button>
      {open ? <div className="flex flex-col gap-2.5 px-3.5 pb-3.5">{children}</div> : null}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid grid-cols-[76px_1fr] items-center gap-2">
      <span className="text-[11px] font-medium" style={{ color: "var(--ink-3)" }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function Pair({
  a,
  b,
}: {
  a: { label: string; value: number; onChange: (v: number) => void; disabled?: boolean };
  b: { label: string; value: number; onChange: (v: number) => void; disabled?: boolean };
}) {
  const cell = (f: typeof a) => (
    <label className="flex items-center gap-1.5 rounded-md border px-2" style={{ borderColor: "var(--line)", background: "var(--panel-2)" }}>
      <span className="text-[10px] font-semibold" style={{ color: "var(--ink-4)" }}>
        {f.label}
      </span>
      <input
        type="number"
        className="mono w-full bg-transparent py-1 text-[12px] outline-none"
        value={Math.round(f.value)}
        disabled={f.disabled}
        onChange={(e) => f.onChange(Number(e.target.value))}
      />
    </label>
  );
  return (
    <div className="grid grid-cols-2 gap-2">
      {cell(a)}
      {cell(b)}
    </div>
  );
}

// ---- schema field --------------------------------------------------------

function Field({
  nodeId,
  settingKey,
  def,
  value,
}: {
  nodeId: string;
  settingKey: string;
  def: SettingDef;
  value: unknown;
}) {
  const setNodeSetting = useStore((s) => s.setNodeSetting);
  const serviceDef = useStore((s) => {
    const n = s.nodes.find((x) => x.id === nodeId);
    return n ? getService(n.service) : undefined;
  });
  const [error, setError] = useState<string | null>(null);

  const apply = (raw: unknown) => {
    if (!serviceDef) return;
    const err = validateSetting(serviceDef, settingKey, raw);
    if (err) {
      setError(err.message);
      return;
    }
    setError(null);
    setNodeSetting(nodeId, settingKey, raw);
  };

  return (
    <div>
      <Row label={def.label}>
        {def.type === "enum" ? (
          <select className="oh-field" value={String(value ?? def.default)} onChange={(e) => apply(e.target.value)}>
            {def.values.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        ) : def.type === "boolean" ? (
          <input type="checkbox" className="justify-self-start" checked={Boolean(value)} onChange={(e) => apply(e.target.checked)} />
        ) : (
          <input
            type="number"
            className="oh-field mono"
            value={value === undefined ? "" : Number(value)}
            min={def.min}
            max={def.max}
            placeholder={def.optional ? "auto" : undefined}
            onChange={(e) => {
              if (e.target.value === "" && def.optional) {
                setError(null);
                setNodeSetting(nodeId, settingKey, undefined);
                return;
              }
              apply(Number(e.target.value));
            }}
          />
        )}
      </Row>
      {error ? <span className="mt-0.5 block text-[10.5px] text-bad">{error}</span> : null}
    </div>
  );
}

// ---- edge ----------------------------------------------------------------

function EdgeInspector({ edgeId }: { edgeId: string }) {
  const edge = useStore((s) => s.edges.find((e) => e.id === edgeId));
  const nodes = useStore((s) => s.nodes);
  const setEdge = useStore((s) => s.setEdge);
  const removeEdge = useStore((s) => s.removeEdge);
  const selectEdge = useStore((s) => s.selectEdge);
  if (!edge) return null;
  const name = (id: string) => nodes.find((n) => n.id === id)?.name ?? id;
  const style = edge.style ?? {};
  const patchStyle = (p: Partial<EdgeStyle>) => {
    const next: EdgeStyle = { ...style, ...p };
    for (const k of Object.keys(next) as (keyof EdgeStyle)[]) if (next[k] === undefined) delete next[k];
    setEdge(edge.id, { style: Object.keys(next).length ? next : undefined });
  };
  const autoWidth = style.width === undefined;
  return (
    <div className="flex h-full flex-col">
      <header className="px-3.5 pb-3 pt-3.5">
        <div className="lab">Edge · {edge.kind}</div>
        <h2 className="mt-0.5 text-[14px] font-semibold">
          {name(edge.from)} → {name(edge.to)}
        </h2>
      </header>

      <Section id="edge-semantics" title="Semantics">
        <Row label="Kind">
          <select className="oh-field" value={edge.kind} onChange={(e) => setEdge(edge.id, { kind: e.target.value as typeof edge.kind })}>
            <option value="sync">sync — request/response</option>
            <option value="async">async — queue/event</option>
            <option value="data">data — storage flow</option>
          </select>
        </Row>
        <Row label="Volume/mo">
          <input
            type="number"
            min={0}
            className="oh-field mono"
            value={edge.volumePerMonth ?? ""}
            placeholder="drives line weight"
            onChange={(e) => setEdge(edge.id, { volumePerMonth: e.target.value === "" ? undefined : Number(e.target.value) })}
          />
        </Row>
        <Row label="Label">
          <input className="oh-field" value={edge.label ?? ""} placeholder="optional" onChange={(e) => setEdge(edge.id, { label: e.target.value || undefined })} />
        </Row>
      </Section>

      <Section id="edge-appearance" title="Appearance" aside={edge.style ? "custom" : "by kind"}>
        <Row label="Weight">
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={1}
              max={6}
              step={0.5}
              className="w-full"
              style={{ accentColor: "var(--accent)" }}
              value={style.width ?? widthFor(edge.volumePerMonth)}
              onChange={(e) => patchStyle({ width: Number(e.target.value) })}
              aria-label="Stroke weight"
            />
            <span className="mono w-9 text-right text-[11px]" style={{ color: "var(--ink-2)" }}>
              {(style.width ?? widthFor(edge.volumePerMonth)).toFixed(1)}
            </span>
          </div>
        </Row>
        <Row label="">
          <label className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--ink-3)" }}>
            <input type="checkbox" checked={autoWidth} onChange={(e) => patchStyle({ width: e.target.checked ? undefined : widthFor(edge.volumePerMonth) })} />
            auto from volume
          </label>
        </Row>
        <Row label="Dash">
          <select className="oh-field" value={style.dash ?? "auto"} onChange={(e) => patchStyle({ dash: e.target.value === "auto" ? undefined : (e.target.value as EdgeStyle["dash"]) })}>
            <option value="auto">by kind ({dashFor(edge.kind)})</option>
            <option value="solid">solid</option>
            <option value="dashed">dashed</option>
            <option value="dotted">dotted</option>
          </select>
        </Row>
        <Row label="Arrowhead">
          <select
            className="oh-field"
            value={style.arrow === undefined ? "auto" : style.arrow ? "on" : "off"}
            onChange={(e) => patchStyle({ arrow: e.target.value === "auto" ? undefined : e.target.value === "on" })}
          >
            <option value="auto">by kind ({edge.kind === "data" ? "none" : "arrow"})</option>
            <option value="on">arrow</option>
            <option value="off">none</option>
          </select>
        </Row>
        <Row label="Route">
          <div className="flex items-center justify-between gap-2 text-[11px]" style={{ color: "var(--ink-3)" }}>
            {edge.route ? (
              <>
                <span className="mono">via {Math.round(edge.route.x)}, {Math.round(edge.route.y)}</span>
                <button className="rounded border px-1.5 py-0.5 hover:bg-panel-2" style={{ borderColor: "var(--line)" }} onClick={() => setEdge(edge.id, { route: undefined })}>
                  reset
                </button>
              </>
            ) : (
              <span>floating — drag the handle on the canvas</span>
            )}
          </div>
        </Row>
      </Section>

      <div className="mt-auto p-3.5">
        <button
          className="w-full rounded border border-line px-3 py-1.5 text-[12px] text-bad hover:bg-panel-2"
          onClick={() => {
            removeEdge(edge.id);
            selectEdge(null);
          }}
        >
          Remove edge
        </button>
      </div>
    </div>
  );
}

// ---- container -----------------------------------------------------------

function ContainerInspector({ containerId }: { containerId: string }) {
  const container = useStore((s) => s.containers.find((c) => c.id === containerId));
  const containers = useStore((s) => s.containers);
  const nodes = useStore((s) => s.nodes);
  const traffic = useStore((s) => s.traffic);
  const region = useStore((s) => s.region);
  const renameContainer = useStore((s) => s.renameContainer);
  const moveContainer = useStore((s) => s.moveContainer);
  const setContainerBounds = useStore((s) => s.setContainerBounds);
  const setContainerCollapsed = useStore((s) => s.setContainerCollapsed);
  const removeContainer = useStore((s) => s.removeContainer);
  const select = useStore((s) => s.select);

  const { box, floor, stat } = useMemo(() => {
    const opts = { nodeW: NODE_W, nodeH: NODE_H };
    let stat;
    try {
      const s = useStore.getState();
      stat = containerStats(snapshotOf(s), pricingOf(s)).get(containerId);
    } catch {
      stat = undefined;
    }
    return {
      box: frameBoxes(nodes, containers, opts).get(containerId) ?? null,
      floor: contentBoxes(nodes, containers, opts).get(containerId) ?? null,
      stat,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, containers, traffic, region, containerId]);

  if (!container) return null;
  const meta = KIND_META[container.kind];
  const chain = ancestorsOf(containers, container.id).reverse().map((c) => c.name);
  const children = containers.filter((c) => c.parent === container.id);
  const members = nodes.filter((n) => n.container === container.id);

  return (
    <div className="flex h-full flex-col">
      <header className="px-3.5 pb-3 pt-3.5">
        <div className="lab" style={{ color: meta.color }}>
          {meta.label}
        </div>
        <div className="mt-0.5 flex items-baseline justify-between gap-2">
          <input
            className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold outline-none focus:underline"
            value={container.name}
            aria-label="Container name"
            onChange={(e) => renameContainer(container.id, e.target.value)}
          />
          {stat ? (
            <span className="mono text-[13px] font-semibold">${stat.monthly.toFixed(2)}/mo</span>
          ) : null}
        </div>
      </header>

      <Section id="ctr-identity" title="Identity">
        <Row label="CIDR">
          <input className="oh-field mono" value={container.cidr ?? ""} placeholder="10.0.0.0/16" onChange={(e) => renameContainer(container.id, container.name, e.target.value)} />
        </Row>
        <Row label="Inside">
          <span className="text-[11.5px]" style={{ color: "var(--ink-2)" }}>
            {chain.length ? chain.join(" › ") : "top level"}
          </span>
        </Row>
      </Section>

      <Section id="ctr-frame" title="Frame" aside={container.bounds ? "pinned" : "derived"}>
        {box ? (
          <>
            <Pair
              a={{ label: "X", value: box.l, onChange: (v) => moveContainer(container.id, v - box.l, 0) }}
              b={{ label: "Y", value: box.t, onChange: (v) => moveContainer(container.id, 0, v - box.t) }}
            />
            <Pair
              a={{ label: "W", value: box.r - box.l, onChange: (v) => setContainerBounds(container.id, { x: box.l, y: box.t, w: v, h: box.b - box.t }) }}
              b={{ label: "H", value: box.b - box.t, onChange: (v) => setContainerBounds(container.id, { x: box.l, y: box.t, w: box.r - box.l, h: v }) }}
            />
            <p className="text-[10.5px] leading-snug" style={{ color: "var(--ink-4)" }}>
              Never smaller than what it holds{floor ? ` (${Math.round(floor.r - floor.l)}×${Math.round(floor.b - floor.t)})` : ""}. Drag the header on the canvas to move it with its contents.
            </p>
            {container.bounds && floor ? (
              <button className="self-start rounded border px-2 py-1 text-[11px] hover:bg-panel-2" style={{ borderColor: "var(--line)", color: "var(--ink-2)" }} onClick={() => setContainerBounds(container.id, undefined)}>
                Fit to contents
              </button>
            ) : null}
          </>
        ) : (
          <p className="text-[11px]" style={{ color: "var(--ink-3)" }}>
            Empty and unplaced.
          </p>
        )}
      </Section>

      <Section id="ctr-contents" title="Contents" aside={stat ? `${stat.resources} · $${stat.monthly.toFixed(0)}` : undefined}>
        {children.length + members.length === 0 ? (
          <p className="text-[11px]" style={{ color: "var(--ink-3)" }}>
            Nothing inside yet — drag a resource in, or add one from the palette with this frame selected.
          </p>
        ) : null}
        {children.map((c) => (
          <button key={c.id} className="flex items-center gap-2 rounded px-1 py-0.5 text-left text-[11.5px] hover:bg-[var(--hover)]" onClick={() => select(c.id)}>
            <span className="h-2 w-2 rounded-sm" style={{ background: KIND_META[c.kind].color }} />
            {c.name}
            <span className="ml-auto text-[10px]" style={{ color: "var(--ink-4)" }}>{KIND_META[c.kind].label}</span>
          </button>
        ))}
        {members.map((n) => (
          <button key={n.id} className="flex items-center gap-2 rounded px-1 py-0.5 text-left text-[11.5px] hover:bg-[var(--hover)]" onClick={() => select(n.id)}>
            <svg width="14" height="14">
              <use href={`#${getService(n.service)?.icon ?? ""}`} width="14" height="14" />
            </svg>
            {n.name}
          </button>
        ))}
        <button className="self-start rounded border px-2 py-1 text-[11px] hover:bg-panel-2" style={{ borderColor: "var(--line)", color: "var(--ink-2)" }} onClick={() => setContainerCollapsed(container.id, !container.collapsed)}>
          {container.collapsed ? "Expand" : "Collapse to a card"}
        </button>
      </Section>

      <div className="mt-auto p-3.5">
        <button
          className="w-full rounded border border-line px-3 py-1.5 text-[12px] text-bad hover:bg-panel-2"
          title="Contents move up one level"
          onClick={() => {
            removeContainer(container.id);
            select(null);
          }}
        >
          Remove container
        </button>
      </div>
    </div>
  );
}

// ---- node ----------------------------------------------------------------

function NodeInspector({ nodeId }: { nodeId: string }) {
  const node = useStore((s) => s.nodes.find((n) => n.id === nodeId));
  const containers = useStore((s) => s.containers);
  const removeNode = useStore((s) => s.removeNode);
  const renameNode = useStore((s) => s.renameNode);
  const moveNode = useStore((s) => s.moveNode);
  const moveIntoContainer = useStore((s) => s.moveIntoContainer);
  const select = useStore((s) => s.select);
  const edges = useStore((s) => s.edges);
  const traffic = useStore((s) => s.traffic);
  const region = useStore((s) => s.region);
  const [placeError, setPlaceError] = useState<string | null>(null);

  const cost = useMemo(() => {
    if (!node) return null;
    try {
      const s = useStore.getState();
      return nodeCost(snapshotOf(s), node.id, pricingOf(s));
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node, traffic, region]);

  const findings = useMemo(() => {
    if (!node) return [];
    try {
      const s = useStore.getState();
      return findingsForNode(snapshotOf(s), pricingOf(s), node.id);
    } catch {
      return [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node, edges, traffic, region]);

  if (!node) return null;
  const def = getService(node.service);
  if (!def) return null;
  const crumb = breadcrumb({ nodes: [node], edges: [], containers, sections: [], traffic }, node.id);

  return (
    <div className="flex h-full flex-col">
      <header className="px-3.5 pb-3 pt-3.5">
        <div className="lab">{def.term}</div>
        <div className="mt-0.5 flex items-baseline justify-between gap-2">
          <input
            className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold outline-none focus:underline"
            value={node.name}
            title="Rename"
            aria-label="Resource name"
            onChange={(e) => renameNode(node.id, e.target.value)}
          />
          {cost ? <span className="mono text-[13px] font-semibold">${toMoney(cost.monthly).toFixed(2)}/mo</span> : null}
        </div>
      </header>

      <Section id="node-position" title="Position" aside={crumb.length ? crumb[crumb.length - 1] : "canvas"}>
        <Pair
          a={{ label: "X", value: node.position.x, onChange: (v) => moveNode(node.id, v, node.position.y) }}
          b={{ label: "Y", value: node.position.y, onChange: (v) => moveNode(node.id, node.position.x, v) }}
        />
        <Row label="Inside">
          <select
            className="oh-field"
            value={node.container ?? ""}
            onChange={(e) => {
              const target = e.target.value || null;
              const kind = target ? containers.find((c) => c.id === target)?.kind ?? null : null;
              const err = validateNodePlacement(node.service, kind);
              if (err) {
                setPlaceError(err.message);
                return;
              }
              const res = moveIntoContainer([node.id], target);
              setPlaceError("error" in res ? res.error.message : null);
            }}
          >
            <option value="">canvas (top level)</option>
            {containers.map((c) => (
              <option key={c.id} value={c.id}>
                {"· ".repeat(ancestorsOf(containers, c.id).length)}
                {c.name} — {KIND_META[c.kind].label}
              </option>
            ))}
          </select>
        </Row>
        {placeError ? <span className="text-[10.5px] text-bad">{placeError}</span> : null}
        {crumb.length ? (
          <div className="text-[10.5px]" style={{ color: "var(--ink-4)" }}>
            {crumb.join(" › ")}
          </div>
        ) : null}
      </Section>

      <Section id="node-settings" title="Settings" aside={`${Object.keys(def.settings).length}`}>
        {Object.entries(def.settings).map(([key, sdef]) => (
          <Field key={key} nodeId={node.id} settingKey={key} def={sdef} value={node.settings[key]} />
        ))}
      </Section>

      {cost ? (
        <Section id="node-cost" title="Cost" aside={`$${toMoney(cost.monthly).toFixed(2)}`}>
          <table className="w-full text-[11px]">
            <tbody>
              {cost.lines.map((l, i) => (
                <tr key={i} className="border-t border-line">
                  <td className="py-1 pr-2">
                    <a className="text-accent underline decoration-dotted" href={l.sourceUrl} target="_blank" rel="noreferrer" title={l.sku}>
                      {l.unit}
                    </a>
                  </td>
                  <td className="mono py-1 text-right">${toMoney(l.monthly).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      ) : null}

      {findings.length ? (
        <Section id="node-findings" title="Findings" aside={`${findings.length}`}>
          {findings.map((f, i) => (
            <div
              key={i}
              className="rounded border-l-2 bg-panel-2 p-2 text-[11px] leading-snug"
              style={{ borderColor: f.severity === "critical" ? "var(--bad)" : f.severity === "warn" ? "var(--warn)" : "var(--accent)" }}
            >
              <p>{f.message}</p>
              <div className="mt-1 flex items-center justify-between">
                <a className="text-accent underline decoration-dotted" href={f.docUrl} target="_blank" rel="noreferrer">
                  AWS docs
                </a>
                {f.estimatedSaving ? <span className="mono font-semibold text-good">−${f.estimatedSaving.toFixed(2)}/mo</span> : null}
              </div>
            </div>
          ))}
        </Section>
      ) : null}

      <div className="mt-auto p-3.5">
        <button
          className="w-full rounded border border-line px-3 py-1.5 text-[12px] text-bad hover:bg-panel-2"
          onClick={() => {
            removeNode(node.id);
            select(null);
          }}
        >
          Remove node
        </button>
      </div>
    </div>
  );
}

// ---- root ----------------------------------------------------------------

export function Inspector() {
  const selectedId = useStore((s) => s.selectedId);
  const selectedEdgeId = useStore((s) => s.selectedEdgeId);
  const isNode = useStore((s) => s.nodes.some((n) => n.id === selectedId));
  const isContainer = useStore((s) => s.containers.some((c) => c.id === selectedId));

  if (isNode && selectedId) return <NodeInspector nodeId={selectedId} />;
  if (isContainer && selectedId) return <ContainerInspector containerId={selectedId} />;
  if (selectedEdgeId) return <EdgeInspector edgeId={selectedEdgeId} />;
  return (
    <p className="p-4 text-[11.5px]" style={{ color: "var(--ink-3)" }}>
      Select a resource, a container frame or an edge on the canvas.
    </p>
  );
}
