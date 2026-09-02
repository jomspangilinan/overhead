"use client";

// Floats from left:80 so it clears the rail. Brand, drawing breadcrumb, the
// price-list provenance pill (region lives here), the monthly total — the
// one loud number on screen — then Scenario and Export.

import { useMemo } from "react";
import {
  useStore,
  pricingOf,
  snapshotOf,
  PRICING_TABLES,
} from "@/store/useStore";
import { monthlyTotal } from "@/engine/cost";
import { toMoney } from "@/engine/model";
import { Icon } from "../Icon";

export function TopBar() {
  const nodes = useStore((s) => s.nodes);
  const edges = useStore((s) => s.edges);
  const traffic = useStore((s) => s.traffic);
  const region = useStore((s) => s.region);
  const setRegion = useStore((s) => s.setRegion);
  const scenario = useStore((s) => s.scenario);
  const setExportPanel = useStore((s) => s.setExportPanel);

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
      className="fixed z-[7] flex items-center gap-3"
      style={{ left: 80, right: 16, top: 16, height: 38 }}
    >
      <span className="text-[15px] font-bold tracking-[-0.025em]">Overhead</span>
      <span className="flex items-center gap-[7px] text-[12.5px] text-ink-2">
        <span style={{ color: "#3A4454" }}>/</span>
        <b className="font-medium" style={{ color: "var(--ink-15)" }}>
          {scenario ? scenario.name : "untitled"}
        </b>
      </span>

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

      <button
        className="flex items-center gap-[7px] rounded-lg px-3 py-[7px] text-[12px] font-medium hover:bg-[var(--hover)]"
        style={{
          border: "1px solid var(--line-2)",
          background: "var(--panel)",
          color: "var(--ink-15)",
        }}
        title={
          scenario
            ? `Scenario "${scenario.name}" is open — commit or discard it on the canvas`
            : "Ask your agent to open a scenario"
        }
      >
        <Icon name="scenario" size={14} />
        {scenario ? scenario.name : "Scenario"}
      </button>
      <button
        className="flex items-center gap-[7px] rounded-lg px-3 py-[7px] text-[12px] font-medium text-white"
        style={{ background: "var(--accent)", border: "1px solid var(--accent)" }}
        onClick={() => setExportPanel("markdown")}
      >
        <Icon name="export" size={14} />
        Export
      </button>
    </header>
  );
}
