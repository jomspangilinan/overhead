"use client";

// The trace read-out. Trace used to be a mode with no feedback: you armed
// T, and nothing on screen said what to do or what had happened. This pill
// says both · "click a resource" while the tool is armed, then the path it
// found, how many hops, and what that path costs a month, with a way out.

import { useMemo } from "react";
import { useStore, pricingOf, snapshotOf } from "@/store/useStore";
import { nodeCost } from "@/engine/cost";
import { traceFrom } from "@/engine/trace";
import { toMoney } from "@/engine/model";

export function TracePill() {
  const tool = useStore((s) => s.tool);
  const traceIds = useStore((s) => s.traceIds);
  const nodes = useStore((s) => s.nodes);
  const setTrace = useStore((s) => s.setTrace);
  const setTool = useStore((s) => s.setTool);
  const region = useStore((s) => s.region);
  const edges = useStore((s) => s.edges);
  const tracePlay = useStore((s) => s.tracePlay);
  const setTracePlay = useStore((s) => s.setTracePlay);
  const traceBranch = useStore((s) => s.traceBranch);

  const traced = traceIds?.length ? traceIds : null;
  const origin = traced ? nodes.find((n) => n.id === traced[0]) : undefined;

  // Derived in a memo, never in the selector (a fresh object per call is a
  // render loop · React #185).
  const monthly = useMemo(() => {
    if (!traced) return 0;
    const s = useStore.getState();
    const snap = snapshotOf(s);
    const pricing = pricingOf(s);
    return traced.reduce((sum, id) => {
      try {
        return sum + nodeCost(snap, id, pricing).monthly;
      } catch {
        return sum;
      }
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [traced, nodes, region]);

  const routes = useMemo(
    () => (traced ? traceFrom(edges, traced[0]).branches : []),
    [traced, edges],
  );

  if (!traced && tool !== "trace") return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-[14px] z-[8] flex justify-center px-4">
      <div className="glass pointer-events-auto flex items-center gap-2.5 rounded-full px-3 py-1.5 text-[11.5px]">
        <span
          className="text-[9.5px] font-semibold uppercase tracking-[0.14em]"
          style={{ color: traced ? "var(--accent-ink)" : "var(--ink-3)" }}
        >
          Trace
        </span>
        {traced && origin ? (
          <>
            <span style={{ color: "var(--ink-15)" }}>
              from <strong className="font-semibold">{origin.name}</strong>
            </span>
            <span className="mono" style={{ color: "var(--ink-2)" }}>
              {traced.length} {traced.length === 1 ? "resource" : "resources"} · ${toMoney(monthly).toFixed(2)}/mo on this path
            </span>
            {/* One route at a time, or the whole reachable set at once. A
                26-resource trace lit all at once is a highlight; walked one
                route at a time it is a request. Both are useful, so both
                are here rather than one being chosen for you. */}
            {routes.length > 1 ? (
              <button
                className="rounded-full px-2 py-0.5 text-[10.5px] hover:bg-[var(--hover-2)]"
                style={{
                  border: "1px solid var(--line-2)",
                  color: tracePlay === "branch" ? "var(--accent-ink)" : "var(--ink-2)",
                  background: tracePlay === "branch" ? "var(--accent-bg)" : undefined,
                }}
                onClick={() => setTracePlay(tracePlay === "branch" ? "all" : "branch")}
                title={
                  tracePlay === "branch"
                    ? "Playing one route at a time · click to light the whole path at once"
                    : "Lighting the whole path · click to walk it one route at a time"
                }
              >
                {tracePlay === "branch"
                  ? `route ${(traceBranch ?? 0) + 1} of ${routes.length}`
                  : `all ${routes.length} routes`}
              </button>
            ) : null}
            <button
              className="rounded-full px-2 py-0.5 text-[10.5px] hover:bg-[var(--hover-2)]"
              style={{ border: "1px solid var(--line-2)", color: "var(--ink-2)" }}
              onClick={() => setTrace(null)}
            >
              Clear
            </button>
            <button
              className="rounded-full px-2 py-0.5 text-[10.5px] hover:bg-[var(--hover-2)]"
              style={{ border: "1px solid var(--line-2)", color: "var(--ink-2)" }}
              onClick={() => {
                setTrace(null);
                setTool("trace");
              }}
            >
              Trace another
            </button>
          </>
        ) : (
          <span style={{ color: "var(--ink-2)" }}>
            Click any resource · the request path downstream lights up and the rest dims.
          </span>
        )}
      </div>
    </div>
  );
}
