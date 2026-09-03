"use client";

// Floats from left:80 so it clears the rail. Brand, drawing breadcrumb, the
// price-list provenance pill (region lives here), the monthly total · the
// one loud number on screen · then Scenario and Export.

import { useMemo } from "react";
import {
  useStore,
  pricingOf,
  pricedOf,
  snapshotOf,
  PRICING_TABLES,
} from "@/store/useStore";
import { monthlyTotal } from "@/engine/cost";
import { toMoney } from "@/engine/model";
import { Icon } from "../Icon";
import { LivePill } from "./LivePill";
import { openScenarioFromUi } from "@/webmcp/scenario";

export function TopBar() {
  const nodes = useStore((s) => s.nodes);
  const edges = useStore((s) => s.edges);
  const traffic = useStore((s) => s.traffic);
  const region = useStore((s) => s.region);
  const priced = useStore(pricedOf);
  const setRegion = useStore((s) => s.setRegion);
  const scenario = useStore((s) => s.scenario);
  const setExportPanel = useStore((s) => s.setExportPanel);
  const setImportPanel = useStore((s) => s.setImportPanel);
  const drawingName = useStore((s) => s.drawingName);
  const setDrawingName = useStore((s) => s.setDrawingName);

  const total = useMemo(() => {
    try {
      const s = useStore.getState();
      return monthlyTotal(snapshotOf(s), pricingOf(s));
    } catch {
      return 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, traffic, region]);

  const generatedAt = useStore((s) => pricingOf(s).generatedAt.slice(0, 10));

  return (
    <header
      className="flex h-full items-center gap-3 px-4"
      style={{ background: "var(--panel)", borderBottom: "1px solid var(--line)" }}
    >
      <span className="text-[15px] font-bold tracking-[-0.025em]">Overhead</span>
      <span className="flex items-center gap-[7px] text-[12.5px] text-ink-2">
        <span style={{ color: "#3A4454" }}>/</span>
        <input
          value={drawingName}
          onChange={(e) => setDrawingName(e.target.value)}
          onBlur={(e) => setDrawingName(e.target.value)}
          title="Drawing name · click to rename"
          aria-label="Drawing name"
          className="min-w-[60px] bg-transparent font-medium outline-none focus:underline"
          style={{ color: "var(--ink-15)", width: `${Math.max(6, drawingName.length + 1)}ch` }}
        />
        {scenario ? (
          <span className="rounded-md px-1.5 py-0.5 text-[10.5px]" style={{ background: "var(--accent-bg)", color: "var(--accent-ink)" }}>
            scenario · {scenario.name}
          </span>
        ) : null}
      </span>

      {/* A flowchart has nothing to price, so it is shown no price list, no
          region and no total · three pieces of chrome about money on a
          drawing that has none (`pricedOf`). An empty canvas still shows
          them: that is where an AWS drawing starts. */}
      {priced ? (
      <label
        className="flex items-center gap-[7px] rounded-[7px] px-2.5 py-[5px] text-[11px] text-ink-3"
        style={{ background: "var(--panel)", border: "1px solid var(--line-2)" }}
        title="Rates come from the AWS Price List Bulk API"
      >
        <span
          className="h-[5px] w-[5px] rounded-full"
          style={{ background: "var(--good)" }}
        />
        Price List ·
        <select
          className="bg-transparent text-ink-3 outline-none"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          aria-label="Pricing region"
          style={{ fontFamily: "var(--font-mono-jb)" }}
        >
          {Object.keys(PRICING_TABLES).map((r) => (
            <option key={r} value={r} style={{ background: "var(--panel)" }}>
              {r}
            </option>
          ))}
        </select>
        · {generatedAt}
      </label>
      ) : null}

      {priced ? (
        <div className="ml-auto flex items-baseline gap-2">
          <span className="lab">Monthly</span>
          <span
            className="text-[23px] font-semibold tracking-[-0.03em]"
            style={{ fontFamily: "var(--font-mono-jb)" }}
          >
            ${toMoney(total).toFixed(2)}
          </span>
          <span className="text-[11px] text-ink-3">estimate</span>
        </div>
      ) : (
        <div className="ml-auto" />
      )}

      {/* Forks on the spot · no dialog to answer first. The name is
          editable in the banner over the canvas, the way the drawing name
          is editable here. */}
      {scenario ? null : (
        <button
          className="flex items-center gap-[7px] rounded-lg px-3 py-[7px] text-[12px] font-medium hover:bg-[var(--hover)]"
          style={{
            border: "1px solid var(--line-2)",
            background: "var(--panel)",
            color: "var(--ink-15)",
          }}
          data-tip="Fork the design · change anything, see the delta, keep it or throw it away"
          aria-label="Scenario"
          onClick={() => void openScenarioFromUi("what-if")}
        >
          <Icon name="scenario" size={14} />
          Scenario
        </button>
      )}
      <LivePill />
      {/* One door in · the seeded templates are a source inside it, because
          a template is an import too: our JSON instead of your YAML. */}
      <button
        className="flex items-center gap-[7px] rounded-lg px-3 py-[7px] text-[12px] font-medium hover:bg-[var(--hover)]"
        style={{ border: "1px solid var(--line-2)", background: "var(--panel)", color: "var(--ink-15)" }}
        data-tip="Import · a template, a saved drawing, or one of the samples"
        aria-label="Import"
        onClick={() => setImportPanel({ fileName: "", template: "" })}
      >
        <Icon name="import" size={14} />
        Import
      </button>
      <button
        className="flex items-center gap-[7px] rounded-lg px-3 py-[7px] text-[12px] font-medium text-white"
        style={{ background: "var(--accent)", border: "1px solid var(--accent)" }}
        data-tip="Export · picture, document, or infrastructure code"
        aria-label="Export"
        onClick={() => setExportPanel("png")}
      >
        <Icon name="export" size={14} />
        Export
      </button>
    </header>
  );
}
