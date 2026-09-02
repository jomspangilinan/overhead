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
        className="absolute left-1/2 top-2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border bg-surface px-4 py-1.5 shadow-md"
        style={{ borderColor: "var(--accent)" }}
      >
        <span
          className="text-[10px] font-semibold uppercase tracking-widest"
          style={{ fontFamily: "var(--font-archivo)", color: "var(--accent)" }}
        >
          Scenario
        </span>
        <span className="text-[12.5px] font-medium">{scenario.name}</span>
        <span
          className="text-[12px] tabular-nums"
          style={{ fontFamily: "var(--font-plex-mono)" }}
        >
          ${delta.baseTotal.toFixed(2)} → ${delta.forkTotal.toFixed(2)}
          <span
            className="ml-1.5 font-semibold"
            style={{
              color: delta.delta > 0 ? "var(--critical)" : "var(--saving)",
            }}
          >
            {sign}
            {delta.delta.toFixed(2)}
          </span>
        </span>
        <button
          className="rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-semibold text-white"
          onClick={() => closeScenarioFromUi("commit")}
        >
          Commit
        </button>
        <button
          className="rounded-full border border-rule px-2.5 py-0.5 text-[11px] hover:bg-surface-2"
          onClick={() => closeScenarioFromUi("discard")}
        >
          Discard
        </button>
      </div>
    </>
  );
}
