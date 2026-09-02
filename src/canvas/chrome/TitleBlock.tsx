"use client";

// Borrowed from engineering drawings: it makes an export read as a document
// of record, and keeps the total in frame in any screenshot.

import { useMemo } from "react";
import { useStore, pricingOf, snapshotOf } from "@/store/useStore";
import { monthlyTotal } from "@/engine/cost";
import { allFindings } from "@/engine/findings";
import { toMoney } from "@/engine/model";
import { Panel } from "./Panel";

function Cell({
  k,
  v,
  good,
  last,
}: {
  k: string;
  v: string;
  good?: boolean;
  last?: boolean;
}) {
  return (
    <div
      className="px-[13px] py-[7px]"
      style={{ borderRight: last ? undefined : "1px solid var(--line)" }}
    >
      <span
        className="block text-[8px] uppercase tracking-[0.13em]"
        style={{ color: "var(--ink-4)" }}
      >
        {k}
      </span>
      <span
        className="text-[11px] font-medium"
        style={{
          fontFamily: "var(--font-mono-jb)",
          color: good ? "var(--good)" : "var(--ink-15)",
        }}
      >
        {v}
      </span>
    </div>
  );
}

export function TitleBlock() {
  const nodes = useStore((s) => s.nodes);
  const edges = useStore((s) => s.edges);
  const groups = useStore((s) => s.groups);
  const traffic = useStore((s) => s.traffic);
  const region = useStore((s) => s.region);

  const { total, findings } = useMemo(() => {
    try {
      const s = useStore.getState();
      const snap = snapshotOf(s);
      const pricing = pricingOf(s);
      return {
        total: monthlyTotal(snap, pricing),
        findings: allFindings(snap, pricing).length,
      };
    } catch {
      return { total: 0, findings: 0 };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, groups, traffic, region]);

  return (
    <Panel
      id="titleblock"
      title="Title block"
      defaults={{ left: 344, bottom: 112, width: "auto" }}
      headerHeight={30}
    >
      <div className="flex">
        <Cell k="Drawing" v="untitled" />
        <Cell k="Region" v={region} />
        <Cell k="Containers" v={String(groups.length)} />
        <Cell k="Resources" v={String(nodes.length)} />
        <Cell k="Findings" v={String(findings)} />
        <Cell k="Est. monthly" v={`$${toMoney(total).toFixed(2)}`} good last />
      </div>
    </Panel>
  );
}
