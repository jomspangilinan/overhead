"use client";

// Visible fork state: dashed accent frame, base vs fork totals, the delta
// drawn in saving/critical colour, commit/discard that also retire the
// scenario tools.

import { useMemo } from "react";
import { useStore, snapshotOf, pricingOf } from "@/store/useStore";
import { computeDelta } from "@/engine/delta";
import { closeScenarioFromUi } from "@/webmcp/scenario";

export function ScenarioBanner() {
  const scenario = useStore((s) => s.scenario);
  const renameScenario = useStore((s) => s.renameScenario);
  const select = useStore((s) => s.select);
  const nodes = useStore((s) => s.nodes);
  const edges = useStore((s) => s.edges);
  const traffic = useStore((s) => s.traffic);
  const region = useStore((s) => s.region);
  const delta = useMemo(() => {
    if (!scenario) return null;
    try {
      const s = useStore.getState();
      return computeDelta(scenario.base, snapshotOf(s), pricingOf(s));
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario, nodes, edges, traffic, region]);

  if (!scenario || !delta) return null;
  const sign = delta.delta > 0 ? "+" : "";
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0 z-40 rounded-sm border-2 border-dashed"
        style={{ borderColor: "var(--accent)" }}
      />
      <div
        className="absolute left-1/2 top-2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border bg-panel px-4 py-1.5 shadow-md"
        style={{ borderColor: "var(--accent)" }}
      >
        <span
          className="text-[10px] font-semibold uppercase tracking-widest"
          style={{ fontFamily: "var(--font-archivo)", color: "var(--accent)" }}
        >
          Scenario
        </span>
        {/* the fork's name, editable in place · opening one never asks */}
        <input
          value={scenario.name}
          onChange={(e) => renameScenario(e.target.value)}
          aria-label="Scenario name"
          data-tip="Name this what-if"
          className="min-w-[40px] bg-transparent text-[12.5px] font-medium outline-none focus:underline"
          style={{ width: `${Math.max(5, scenario.name.length + 1)}ch` }}
        />
        <span
          className="text-[12px] tabular-nums"
          style={{ fontFamily: "var(--font-mono-jb)" }}
        >
          ${delta.baseTotal.toFixed(2)} → ${delta.forkTotal.toFixed(2)}
          <span
            className="ml-1.5 font-semibold"
            style={{
              color: delta.delta > 0 ? "var(--bad)" : "var(--good)",
            }}
          >
            {sign}
            {delta.delta.toFixed(2)}
          </span>
        </span>
        <button
          className="rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-semibold text-white"
          data-tip="Keep these changes in the drawing"
          onClick={() => closeScenarioFromUi("commit")}
        >
          Commit
        </button>
        <button
          className="rounded-full border border-line px-2.5 py-0.5 text-[11px] hover:bg-panel-2"
          data-tip="Throw the fork away · the drawing goes back"
          onClick={() => closeScenarioFromUi("discard")}
        >
          Discard
        </button>
      </div>

      {/* What the fork actually did. Without this the banner was two totals
          and two buttons, and a scenario with no edits yet looked broken. */}
      <div className="absolute left-1/2 top-[46px] z-50 w-[380px] max-w-[calc(100%-24px)] -translate-x-1/2">
        <div className="glass rounded-xl px-3 py-2">
          {delta.nodes.length === 0 ? (
            <p className="text-[11.5px] leading-snug" style={{ color: "var(--ink-2)" }}>
              Nothing changed yet. Edit a setting, add or remove a resource · every difference against the
              original lands here, priced. Commit keeps it, Discard puts the drawing back.
            </p>
          ) : (
            <>
              <div className="lab pb-1">
                {delta.nodes.length} {delta.nodes.length === 1 ? "change" : "changes"} vs the original
              </div>
              <ul className="flex max-h-[168px] flex-col gap-1 overflow-y-auto">
                {delta.nodes.map((n) => (
                  <li key={n.id} className="flex items-baseline gap-2 text-[11.5px]">
                    <button
                      className="shrink-0 font-medium hover:underline"
                      style={{ color: "var(--ink-15)" }}
                      onClick={() => select(n.id)}
                      title="Select this resource"
                    >
                      {n.name}
                    </button>
                    <span className="min-w-0 flex-1 truncate" style={{ color: "var(--ink-3)" }}>
                      {n.kind === "added"
                        ? "added"
                        : n.kind === "removed"
                          ? "removed"
                          : n.changes.length
                            ? n.changes.map((c) => `${c.key} ${String(c.from ?? "default")} → ${String(c.to)}`).join(" · ")
                            : "repriced"}
                    </span>
                    <span
                      className="mono shrink-0 text-[11px] font-semibold"
                      style={{ color: n.delta > 0 ? "var(--bad)" : n.delta < 0 ? "var(--good)" : "var(--ink-3)" }}
                    >
                      {n.delta > 0 ? "+" : ""}
                      {n.delta.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </>
  );
}
