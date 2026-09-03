"use client";

// One docked strip along the bottom: the drawing's facts (borrowed from an
// engineering title block) on the left, the WebMCP agent readout on the
// right · live tool count and the last three calls.

import { useEffect, useMemo, useState } from "react";
import { useStore, pricingOf, pricedOf, snapshotOf } from "@/store/useStore";
import { monthlyTotal } from "@/engine/cost";
import { allFindings } from "@/engine/findings";
import { toMoney } from "@/engine/model";
import {
  liveTools,
  onToolChange,
  onCall,
  recentCalls,
  type RegisteredTool,
  type ToolCall,
} from "@/webmcp/toolRegistry";

function Fact({ k, v, good }: { k: string; v: string; good?: boolean }) {
  return (
    <div className="flex items-baseline gap-1.5 whitespace-nowrap">
      <span className="text-[8px] uppercase tracking-[0.13em]" style={{ color: "var(--ink-4)" }}>
        {k}
      </span>
      <span
        className="text-[11px] font-medium"
        style={{ fontFamily: "var(--font-mono-jb)", color: good ? "var(--good)" : "var(--ink-15)" }}
      >
        {v}
      </span>
    </div>
  );
}

export function BottomBar() {
  const nodes = useStore((s) => s.nodes);
  const edges = useStore((s) => s.edges);
  const containers = useStore((s) => s.containers);
  const traffic = useStore((s) => s.traffic);
  const region = useStore((s) => s.region);
  const priced = useStore(pricedOf);
  const drawingName = useStore((s) => s.drawingName);
  const outcome = useStore((s) => s.webmcpOutcome);

  const { total, findings } = useMemo(() => {
    try {
      const s = useStore.getState();
      const snap = snapshotOf(s);
      const pricing = pricingOf(s);
      return { total: monthlyTotal(snap, pricing), findings: allFindings(snap, pricing).length };
    } catch {
      return { total: 0, findings: 0 };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, containers, traffic, region]);

  const [tools, setTools] = useState<RegisteredTool[]>([]);
  const [calls, setCalls] = useState<ToolCall[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setTools(liveTools());
    return onToolChange(() => setTools(liveTools()));
  }, []);
  useEffect(() => {
    setCalls(recentCalls());
    return onCall(() => setCalls(recentCalls()));
  }, []);
  const dynamicCount = tools.filter((t) => t.dynamic).length;
  const live = outcome === "registered";

  return (
    <footer
      className="relative flex h-9 items-center gap-4 overflow-hidden px-3 text-[11.5px] text-ink-2"
      style={{ background: "var(--panel)", borderTop: "1px solid var(--line)" }}
    >
      <div className="flex items-center gap-4">
        <Fact k="Drawing" v={drawingName} />
        {priced ? <Fact k="Region" v={region} /> : null}
        <Fact k="Containers" v={String(containers.length)} />
        <Fact k="Resources" v={String(nodes.length)} />
        {priced ? <Fact k="Findings" v={String(findings)} /> : null}
        {/* Nothing here is priced and no rule can fire on it · see pricedOf. */}
        {priced ? <Fact k="Est. monthly" v={`$${toMoney(total).toFixed(2)}`} good /> : null}
      </div>

      <div className="ml-auto flex min-w-0 items-center gap-[11px]">
        <div
          className="hidden gap-[15px] whitespace-nowrap text-[10.5px] lg:flex"
          style={{ fontFamily: "var(--font-mono-jb)", color: "var(--ink-4)" }}
        >
          {calls.map((c) => (
            <span key={c.at + c.name}>
              {c.name}{" "}
              <i className="not-italic" style={{ color: "var(--good)" }}>
                {c.summary}
              </i>
            </span>
          ))}
        </div>
        <button
          className="flex items-center gap-2 whitespace-nowrap"
          onClick={() => setOpen((o) => !o)}
          title="Show the live tool list"
        >
          <span
            className="h-[7px] w-[7px] rounded-full"
            style={{
              background: live ? "var(--good)" : "var(--warn)",
              boxShadow: live ? "0 0 0 3px #6FE3B024" : "0 0 0 3px #F0B34E24",
            }}
          />
          {live ? (
            <span>
              <b className="font-medium" style={{ color: "var(--ink-15)" }}>WebMCP</b> ·{" "}
              <span className="font-semibold" style={{ fontFamily: "var(--font-mono-jb)", color: "var(--accent-ink)" }}>
                {tools.length}
              </span>{" "}
              tools live{dynamicCount ? ` · ${dynamicCount} scenario` : " · +4 in a scenario"}
            </span>
          ) : (
            <span style={{ color: "var(--warn)" }}>
              {outcome === "checking"
                ? "Checking for WebMCP…"
                : outcome === "in-iframe"
                  ? "In an iframe · tools invisible"
                  : outcome === "error"
                    ? "Tool registration threw · see console"
                    : "No WebMCP here · open in the ChatGPT desktop app, or Chrome with #enable-webmcp-testing"}
            </span>
          )}
        </button>
      </div>

      {open && tools.length > 0 ? (
        <div
          className="glass absolute bottom-10 right-3 z-[9] max-h-72 w-64 overflow-y-auto rounded-[12px] p-2"
        >
          {tools.map((t) => (
            <div
              key={t.name}
              className="flex items-center gap-1.5 rounded px-1.5 py-1 text-[11px] hover:bg-[var(--hover)]"
              title={t.description}
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: t.dynamic ? "var(--good)" : "var(--accent)" }}
              />
              <span style={{ fontFamily: "var(--font-mono-jb)" }}>{t.name}</span>
            </div>
          ))}
        </div>
      ) : null}
    </footer>
  );
}
