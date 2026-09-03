"use client";

// One anchored popover at a time, opened by a gear: a node's card and
// security settings, or the View gear (layers, cards, cost display).
// Frames have no gear · selecting one opens it in the Inspector, and two
// ways to edit the same fields read as redundant. Positioned in canvas
// coordinates (store.popover), clamped to the canvas; closes on outside
// click or Escape.

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useStore, cardModeOf } from "@/store/useStore";
import { getService } from "@/engine/services";
import { validateSetting, settingsInGroup, defaultSettings, type SettingDef } from "@/engine/defineService";
import { DEFAULT_CARD_SHOW, DEFAULT_COST_DISPLAY } from "@/engine/model";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid grid-cols-[88px_1fr] items-center gap-2 text-[11px]">
      <span style={{ color: "var(--ink-3)" }}>{label}</span>
      {children}
    </label>
  );
}

function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex items-center gap-2 text-[11.5px]" style={{ color: "var(--ink-2)" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  );
}

function Tabs({ tabs, active, onPick }: { tabs: string[]; active: string; onPick: (t: string) => void }) {
  return (
    <div className="mb-2 flex gap-1 rounded-lg p-[2px]" style={{ background: "var(--panel-2)" }}>
      {tabs.map((t) => (
        <button
          key={t}
          className="flex-1 rounded-md px-2 py-1 text-[11px] font-medium"
          style={{ background: active === t ? "var(--accent-bg)" : undefined, color: active === t ? "var(--accent-ink)" : "var(--ink-3)" }}
          onClick={() => onPick(t)}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

/** A schema-driven field, same validation the Inspector and set_property use. */
function SettingField({ nodeId, settingKey, def, value }: { nodeId: string; settingKey: string; def: SettingDef; value: unknown }) {
  const setNodeSetting = useStore((s) => s.setNodeSetting);
  const service = useStore((s) => {
    const n = s.nodes.find((x) => x.id === nodeId);
    return n ? getService(n.service) : undefined;
  });
  const [error, setError] = useState<string | null>(null);
  const apply = (raw: unknown) => {
    if (!service) return;
    const err = validateSetting(service, settingKey, raw);
    if (err) return setError(err.message);
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
          <input type="checkbox" className="justify-self-start" checked={Boolean(value ?? def.default)} onChange={(e) => apply(e.target.checked)} />
        ) : (
          <input type="number" className="oh-field mono" value={value === undefined ? "" : Number(value)} onChange={(e) => apply(Number(e.target.value))} />
        )}
      </Row>
      {def.description ? (
        <div className="mt-0.5 text-[10px]" style={{ color: "var(--ink-4)" }}>
          {def.description}
        </div>
      ) : null}
      {error ? <span className="mt-0.5 block text-[10.5px] text-bad">{error}</span> : null}
    </div>
  );
}

function CardPopover({ nodeId }: { nodeId: string }) {
  const node = useStore((s) => s.nodes.find((n) => n.id === nodeId));
  const cardShow = useStore((s) => s.cardShow);
  const setNodeCard = useStore((s) => s.setNodeCard);
  const [tab, setTab] = useState("Security");
  if (!node) return null;
  const def = getService(node.service);
  if (!def) return null;
  const lines = node.card?.lines ?? [...def.cardLines];
  const merged = { ...defaultSettings(def), ...node.settings };
  return (
    <>
      <div className="mb-1.5 text-[12px] font-semibold">{node.name}</div>
      <Tabs tabs={["Security", "Card"]} active={tab} onPick={setTab} />
      {tab === "Security" ? (
        <div className="flex flex-col gap-2">
          {settingsInGroup(def, "security").map(([key, sdef]) => (
            <SettingField key={key} nodeId={node.id} settingKey={key} def={sdef} value={node.settings[key]} />
          ))}
          <div className="text-[10.5px]" style={{ color: "var(--ink-4)" }}>
            Badge: <span className="mono" style={{ color: "var(--ink-2)" }}>{def.badge?.(merged) ?? "none"}</span> · exported to CDK
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <div className="text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--ink-4)" }}>
            Lines on this card
          </div>
          {Object.entries(def.settings)
            .filter(([, s]) => (s.group ?? "settings") === "settings")
            .map(([key, s]) => (
              <Check
                key={key}
                checked={lines.includes(key)}
                onChange={(on) => {
                  const next = on ? [...lines, key] : lines.filter((k) => k !== key);
                  const isDefault = next.length === def.cardLines.length && def.cardLines.every((k) => next.includes(k));
                  setNodeCard(node.id, { lines: isDefault ? undefined : next });
                }}
              >
                {s.label}
                {def.cardLines.includes(key) ? (
                  <span className="text-[9.5px]" style={{ color: "var(--ink-4)" }}>
                    default
                  </span>
                ) : null}
              </Check>
            ))}
          <div className="mt-1 text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--ink-4)" }}>
            Also show
          </div>
          <Check checked={node.card?.cost ?? cardShow.cost} onChange={(v) => setNodeCard(node.id, { cost: v === cardShow.cost ? undefined : v })}>
            Monthly cost
          </Check>
          <Check checked={node.card?.badge ?? cardShow.badge} onChange={(v) => setNodeCard(node.id, { badge: v === cardShow.badge ? undefined : v })}>
            Security badge (when the layer is on)
          </Check>
          {node.card ? (
            <button className="mt-1 self-start rounded border px-2 py-0.5 text-[10.5px] hover:bg-panel-2" style={{ borderColor: "var(--line)", color: "var(--ink-2)" }} onClick={() => setNodeCard(node.id, undefined)}>
              Reset to defaults
            </button>
          ) : null}
        </div>
      )}
    </>
  );
}


function ViewPopover() {
  const layers = useStore((s) => s.layers);
  const setLayer = useStore((s) => s.setLayer);
  const gridOn = useStore((s) => s.gridOn);
  const setGridOn = useStore((s) => s.setGridOn);
  const [tab, setTab] = useState("Layers");
  return (
    <>
      <div className="mb-1.5 text-[12px] font-semibold">View</div>
      <Tabs tabs={["Layers", "Cards", "Cost"]} active={tab} onPick={setTab} />
      {tab === "Layers" ? (
        <div className="flex flex-col gap-1.5">
          <Check checked={layers.sections} onChange={(v) => setLayer("sections", v)}>
            Sections
          </Check>
          <Check checked={layers.security} onChange={(v) => setLayer("security", v)}>
            Security badges
          </Check>
          <Check checked={layers.cost} onChange={(v) => setLayer("cost", v)}>
            Cost figures
          </Check>
          <div className="mt-1 text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--ink-4)" }}>
            Connections
          </div>
          <Check checked={layers.request} onChange={(v) => setLayer("request", v)}>
            Requests (sync)
          </Check>
          <Check checked={layers.events} onChange={(v) => setLayer("events", v)}>
            Events (async)
          </Check>
          <Check checked={layers.data} onChange={(v) => setLayer("data", v)}>
            Data flow
          </Check>
          <div className="mt-1 text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--ink-4)" }}>
            Canvas
          </div>
          <Check checked={gridOn} onChange={setGridOn}>
            Grid · ⇧G
          </Check>
        </div>
      ) : tab === "Cards" ? (
        <CardsPopover />
      ) : (
        <CostPopover />
      )}
    </>
  );
}

function CostPopover() {
  const d = useStore((s) => s.costDisplay);
  const set = useStore((s) => s.setCostDisplay);
  const layers = useStore((s) => s.layers);
  const setLayer = useStore((s) => s.setLayer);
  return (
    <div className="flex flex-col gap-2">
      <Check checked={layers.cost} onChange={(v) => setLayer("cost", v)}>
        Show cost figures
      </Check>
      <Row label="Period">
        <div className="flex gap-1">
          {(["month", "year"] as const).map((p) => (
            <button key={p} className="flex-1 rounded-md px-2 py-1 text-[11px]" style={{ background: d.period === p ? "var(--accent-bg)" : "var(--panel-2)", border: "1px solid var(--line)", color: d.period === p ? "var(--accent-ink)" : "var(--ink-2)" }} onClick={() => set({ period: p })}>
              per {p}
            </button>
          ))}
        </div>
      </Row>
      <Row label="Decimals">
        <div className="flex gap-1">
          {([0, 2] as const).map((n) => (
            <button key={n} className="mono flex-1 rounded-md px-2 py-1 text-[11px]" style={{ background: d.decimals === n ? "var(--accent-bg)" : "var(--panel-2)", border: "1px solid var(--line)", color: d.decimals === n ? "var(--accent-ink)" : "var(--ink-2)" }} onClick={() => set({ decimals: n })}>
              {n === 0 ? "$12" : "$12.34"}
            </button>
          ))}
        </div>
      </Row>
      <div className="text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--ink-4)" }}>
        Show on
      </div>
      <Check checked={d.nodes} onChange={(v) => set({ nodes: v })}>
        Resources
      </Check>
      <Check checked={d.containers} onChange={(v) => set({ containers: v })}>
        Container frames (rolled up)
      </Check>
      <button className="self-start rounded border px-2 py-0.5 text-[10.5px] hover:bg-panel-2" style={{ borderColor: "var(--line)", color: "var(--ink-2)" }} onClick={() => set({ ...DEFAULT_COST_DISPLAY })}>
        Reset
      </button>
    </div>
  );
}

function CardsPopover() {
  const c = useStore((s) => s.cardShow);
  const set = useStore((s) => s.setCardShow);
  const cardsForced = useStore((s) => s.cardsForced);
  const setCardsForced = useStore((s) => s.setCardsForced);
  // Cards have three sources and the checkbox is only one of them, so on its
  // own it reads as broken: cards on screen, box unticked. It says which
  // source is live instead of leaving you to work it out from a parenthesis.
  const cards = useStore(cardModeOf);
  const zoom = useStore((s) => s.zoom);
  const costOn = useStore((s) => s.layers.cost);
  const why = cardsForced ? null : costOn ? "the cost layer" : cards ? `${Math.round(zoom * 100)}% zoom` : null;
  return (
    <div className="flex flex-col gap-2">
      <Check checked={cardsForced} onChange={setCardsForced}>
        Card view · K
      </Check>
      <div className="text-[10.5px] leading-snug" style={{ color: why ? "var(--accent-ink)" : "var(--ink-4)" }}>
        {why
          ? `Cards are on from ${why} · the box pins them on when that changes.`
          : "Cards also appear on their own from 130% zoom, or with the cost layer on."}
      </div>
      <div className="text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--ink-4)" }}>
        Every card shows
      </div>
      <Check checked={c.settings} onChange={(v) => set({ settings: v })}>
        The settings that decide price
      </Check>
      <Check checked={c.cost} onChange={(v) => set({ cost: v })}>
        Monthly cost
      </Check>
      <Check checked={c.badge} onChange={(v) => set({ badge: v })}>
        Security badge (when the layer is on)
      </Check>
      <div className="text-[10.5px]" style={{ color: "var(--ink-4)" }}>
        The gear on a card overrides these for that resource.
      </div>
      <button className="self-start rounded border px-2 py-0.5 text-[10.5px] hover:bg-panel-2" style={{ borderColor: "var(--line)", color: "var(--ink-2)" }} onClick={() => set({ ...DEFAULT_CARD_SHOW })}>
        Reset
      </button>
    </div>
  );
}

export function Popovers() {
  const popover = useStore((s) => s.popover);
  const setPopover = useStore((s) => s.setPopover);
  const ref = useRef<HTMLDivElement>(null);
  // Measured once the panel is in the DOM: how far to slide it back inside
  // the canvas. Computed against its un-nudged rectangle, so re-opening
  // never compounds an earlier correction.
  const [nudge, setNudge] = useState({ dx: 0, dy: 0 });
  const applied = useRef({ dx: 0, dy: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    const host = el?.parentElement;
    if (!el || !host) return;
    const r = el.getBoundingClientRect();
    const h = host.getBoundingClientRect();
    const { dx: ax, dy: ay } = applied.current;
    const l = r.left - ax;
    const t = r.top - ay;
    let dx = 0;
    let dy = 0;
    if (l < h.left + 8) dx = h.left + 8 - l;
    else if (l + r.width > h.right - 8) dx = Math.min(0, h.right - 8 - (l + r.width));
    if (t < h.top + 8) dy = h.top + 8 - t;
    else if (t + r.height > h.bottom - 8) dy = Math.min(0, h.bottom - 8 - (t + r.height));
    applied.current = { dx, dy };
    setNudge((prev) => (prev.dx === dx && prev.dy === dy ? prev : { dx, dy }));
  }, [popover?.kind, popover?.id, popover?.x, popover?.y]);

  useEffect(() => {
    if (!popover) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      setPopover(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPopover(null);
    };
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [popover, setPopover]);

  if (!popover) return null;
  // Anchored purely by transform: `top` is the anchor point and the panel
  // grows up from it (View gear, above the toolbar) or down from it (a
  // card gear). Nothing here reads the host's size · doing that during
  // the first render, while the ref is still null, fell back to a guessed
  // 800px height and opened the View panel far above the toolbar.
  const W = 280;
  const up = popover.kind === "canvas";
  const left = popover.kind === "card" ? popover.x - W : up ? popover.x - W / 2 : popover.x;
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Settings"
      className="glass absolute z-[9] flex max-h-[420px] flex-col gap-2 overflow-auto rounded-xl p-3"
      style={{
        left,
        top: popover.y,
        width: W,
        transform: `translate(${nudge.dx}px, ${nudge.dy}px)${up ? " translateY(-100%)" : ""}`,
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {popover.kind === "card" && popover.id ? <CardPopover nodeId={popover.id} /> : null}
      {popover.kind === "canvas" ? <ViewPopover /> : null}
    </div>
  );
}
