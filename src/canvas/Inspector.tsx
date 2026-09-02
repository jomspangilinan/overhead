"use client";

// The inspector is generated from the settings schema — the console's own
// fields, one vocabulary for the human and the agent. Settings never sit
// on the diagram.

import { useStore, pricingOf, snapshotOf } from "@/store/useStore";
import { getService } from "@/engine/services";
import { validateSetting, type SettingDef } from "@/engine/defineService";
import { nodeCost } from "@/engine/cost";
import { findingsForNode } from "@/engine/findings";
import { toMoney } from "@/engine/model";
import { useMemo, useState } from "react";

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
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-ink-3">
        {def.label}
      </span>
      {def.type === "enum" ? (
        <select
          className="w-full rounded border border-line bg-panel-2 px-2 py-1 text-[12.5px]"
          value={String(value ?? def.default)}
          onChange={(e) => apply(e.target.value)}
        >
          {def.values.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      ) : def.type === "boolean" ? (
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => apply(e.target.checked)}
        />
      ) : (
        <input
          type="number"
          className="w-full rounded border border-line bg-panel-2 px-2 py-1 text-[12.5px]"
          style={{ fontFamily: "var(--font-mono-jb)" }}
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
      {error ? (
        <span className="mt-0.5 block text-[10.5px] text-bad">{error}</span>
      ) : null}
    </label>
  );
}

export function Inspector() {
  const selectedId = useStore((s) => s.selectedId);
  const node = useStore((s) => s.nodes.find((n) => n.id === selectedId));
  const removeNode = useStore((s) => s.removeNode);
  const select = useStore((s) => s.select);
  const edges = useStore((s) => s.edges);
  const traffic = useStore((s) => s.traffic);
  const region = useStore((s) => s.region);

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

  if (!node) {
    return (
      <p className="p-4 text-[11.5px] text-ink-3">
        Select a resource on the canvas.
      </p>
    );
  }
  const def = getService(node.service);
  if (!def) return null;

  return (
    <div className="flex flex-col gap-4 p-3.5">
      <header>
        <div
          className="text-[10px] font-semibold uppercase tracking-wider text-ink-3"
          style={{ fontFamily: "var(--font-archivo)" }}
        >
          {def.term}
        </div>
        <div className="flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold">{node.name}</h2>
          {cost ? (
            <span
              className="text-[13px] font-semibold"
              style={{ fontFamily: "var(--font-mono-jb)" }}
            >
              ${toMoney(cost.monthly).toFixed(2)}/mo
            </span>
          ) : null}
        </div>
      </header>

      <div className="flex flex-col gap-2.5">
        {Object.entries(def.settings).map(([key, sdef]) => (
          <Field
            key={key}
            nodeId={node.id}
            settingKey={key}
            def={sdef}
            value={node.settings[key]}
          />
        ))}
      </div>

      {cost ? (
        <div>
          <div className="mb-1 text-[11px] font-medium text-ink-3">
            Cost lines
          </div>
          <table className="w-full text-[11px]">
            <tbody>
              {cost.lines.map((l, i) => (
                <tr key={i} className="border-t border-line">
                  <td className="py-1 pr-2">
                    <a
                      className="text-accent underline decoration-dotted"
                      href={l.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      title={l.sku}
                    >
                      {l.unit}
                    </a>
                  </td>
                  <td
                    className="py-1 text-right"
                    style={{ fontFamily: "var(--font-mono-jb)" }}
                  >
                    ${toMoney(l.monthly).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {findings.length ? (
        <div>
          <div className="mb-1 text-[11px] font-medium text-ink-3">Findings</div>
          <div className="flex flex-col gap-2">
            {findings.map((f, i) => (
              <div
                key={i}
                className="rounded border-l-2 bg-panel-2 p-2 text-[11px] leading-snug"
                style={{
                  borderColor:
                    f.severity === "critical"
                      ? "var(--bad)"
                      : f.severity === "warn"
                        ? "var(--warn)"
                        : "var(--accent)",
                }}
              >
                <p>{f.message}</p>
                <div className="mt-1 flex items-center justify-between">
                  <a
                    className="text-accent underline decoration-dotted"
                    href={f.docUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    AWS docs
                  </a>
                  {f.estimatedSaving ? (
                    <span
                      className="font-semibold text-good"
                      style={{ fontFamily: "var(--font-mono-jb)" }}
                    >
                      −${f.estimatedSaving.toFixed(2)}/mo
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <button
        className="mt-auto rounded border border-line px-3 py-1.5 text-[12px] text-bad hover:bg-panel-2"
        onClick={() => {
          removeNode(node.id);
          select(null);
        }}
      >
        Remove node
      </button>
    </div>
  );
}
