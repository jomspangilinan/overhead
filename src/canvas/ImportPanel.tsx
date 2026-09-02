"use client";

// Import a CloudFormation template · and, because a drawing is usually not
// empty when a template arrives, show what the template would do to it
// before it does anything. The two buttons are the two honest answers to
// "the repo and the drawing disagree": take the template, or take the
// template only where it speaks.
//
// This is the door back through the export. It is not a live sync: nothing
// here watches a repo, and nothing writes to one.

import { useEffect, useMemo, useRef, useState } from "react";
import { useStore, pricingOf, snapshotOf } from "@/store/useStore";
import { importCloudFormation } from "@/engine/iac/cloudformation";
import { applyReconciliation, placeNewNodes, reconcile, type MergeMode } from "@/engine/iac/reconcile";
import { monthlyTotal } from "@/engine/cost";
import { toMoney } from "@/engine/model";

const TONE: Record<string, string> = {
  added: "var(--good)",
  removed: "var(--bad)",
  changed: "var(--warn)",
  same: "var(--ink-3)",
};

export function ImportPanel() {
  const panel = useStore((s) => s.importPanel);
  const setImportPanel = useStore((s) => s.setImportPanel);
  const loadSnapshot = useStore((s) => s.loadSnapshot);
  const applyAutoLayout = useStore((s) => s.applyAutoLayout);
  const notify = useStore((s) => s.notify);
  const region = useStore((s) => s.region);
  const nodes = useStore((s) => s.nodes);
  const fileInput = useRef<HTMLInputElement>(null);
  const [showAll, setShowAll] = useState(false);

  const parsed = useMemo(
    () => (panel ? importCloudFormation(panel.template, { region }) : null),
    [panel, region],
  );

  const diff = useMemo(() => {
    if (!parsed?.ok) return null;
    return reconcile(snapshotOf(useStore.getState()), parsed.snapshot, parsed.stated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed, nodes]);

  const estimate = useMemo(() => {
    if (!parsed?.ok) return null;
    try {
      return monthlyTotal(parsed.snapshot, pricingOf(useStore.getState()));
    } catch {
      return null;
    }
  }, [parsed]);

  useEffect(() => {
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setImportPanel(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel, setImportPanel]);

  if (!panel) return null;

  const apply = (mode: MergeMode) => {
    if (!parsed?.ok || !diff) return;
    const current = snapshotOf(useStore.getState());
    const next = applyReconciliation(current, parsed.snapshot, diff, mode, parsed.stated);
    const addedIds = diff.nodes.filter((n) => n.kind === "added").map((n) => diff.matched[n.id] ?? n.id);
    loadSnapshot(mode === "merge" ? placeNewNodes(next, addedIds) : next);
    // A template carries no geometry · a wholesale import has to be arranged.
    if (mode === "replace") applyAutoLayout();
    setImportPanel(null);
    notify(
      mode === "replace"
        ? `Imported ${parsed.report.nodes} resources from ${panel.fileName}`
        : `Merged ${panel.fileName}: ${diff.counts.added} added · ${diff.counts.changed} changed · ${diff.counts.removed} left alone`,
    );
  };

  const rows = diff ? diff.nodes.filter((n) => (showAll ? true : n.kind !== "same")) : [];

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center"
      style={{ background: "rgba(5, 7, 10, 0.55)" }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) setImportPanel(null);
      }}
      role="dialog"
      aria-modal
      aria-label="Import CloudFormation"
    >
      <div className="glass flex h-[560px] max-h-[calc(100vh-64px)] w-[720px] max-w-[calc(100vw-48px)] flex-col rounded-2xl">
        <div className="flex items-baseline justify-between border-b px-5 py-3.5" style={{ borderColor: "var(--line)" }}>
          <div>
            <h2 className="text-[15px] font-semibold">Import CloudFormation</h2>
            <p className="text-[11.5px]" style={{ color: "var(--ink-3)" }}>
              {panel.fileName} · parsed in this tab, nothing is uploaded.
            </p>
          </div>
          <button
            className="rounded-md px-2 py-1 text-[12px] hover:bg-[var(--hover)]"
            style={{ color: "var(--ink-3)" }}
            onClick={() => setImportPanel(null)}
          >
            esc
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {!panel.template ? (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <p className="text-[12.5px]" style={{ color: "var(--ink-2)" }}>
                A CloudFormation template · YAML or JSON.
              </p>
              <p className="max-w-[420px] text-center text-[11.5px] leading-relaxed" style={{ color: "var(--ink-3)" }}>
                From <code>cdk synth</code>, the console, or a repo. Drop one anywhere on the canvas, or pick a file.
                A template Overhead wrote comes back exactly; anyone else&apos;s comes back as the resources it
                models, with the connections read from what references what.
              </p>
              <button
                className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-white"
                style={{ background: "var(--accent)" }}
                onClick={() => fileInput.current?.click()}
              >
                Choose a template
              </button>
              <input
                ref={fileInput}
                type="file"
                accept=".yaml,.yml,.json,.template,.txt"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) setImportPanel({ fileName: file.name, template: await file.text() });
                }}
              />
            </div>
          ) : !parsed?.ok ? (
            <div className="rounded-lg p-4 text-[12.5px]" style={{ background: "var(--panel-2)", color: "var(--bad)" }}>
              {parsed?.message ?? "That template could not be read."}
            </div>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px]" style={{ color: "var(--ink-2)" }}>
                <span>
                  <strong style={{ fontFamily: "var(--font-mono-jb)" }}>{parsed.report.nodes}</strong> resources ·{" "}
                  <strong style={{ fontFamily: "var(--font-mono-jb)" }}>{parsed.report.edges}</strong> connections ·{" "}
                  <strong style={{ fontFamily: "var(--font-mono-jb)" }}>{parsed.report.containers}</strong> containers
                </span>
                {estimate !== null ? (
                  <span style={{ color: "var(--ink)" }}>
                    Estimate{" "}
                    <strong style={{ fontFamily: "var(--font-mono-jb)" }}>${toMoney(estimate).toFixed(2)}</strong>/month
                  </span>
                ) : null}
                <span style={{ color: "var(--ink-3)" }}>
                  {parsed.report.source === "overhead" ? "Written by Overhead" : "Read structurally"}
                </span>
              </div>

              {parsed.report.notes.map((note) => (
                <p key={note} className="mb-1.5 text-[11px] leading-relaxed" style={{ color: "var(--ink-3)" }}>
                  {note}
                </p>
              ))}

              {diff ? (
                <>
                  <div className="mb-2 mt-4 flex items-baseline justify-between">
                    <div className="lab">Against this drawing</div>
                    <button
                      className="text-[11px] hover:underline"
                      style={{ color: "var(--ink-3)" }}
                      onClick={() => setShowAll(!showAll)}
                    >
                      {showAll ? "only differences" : `show all ${diff.nodes.length}`}
                    </button>
                  </div>
                  {rows.length === 0 ? (
                    <p className="text-[12px]" style={{ color: "var(--ink-3)" }}>
                      Nothing differs · the template and the drawing already agree.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-[3px]">
                      {rows.map((n) => (
                        <li
                          key={`${n.kind}-${n.id}`}
                          className="flex items-baseline gap-2 rounded-md px-2 py-1 text-[12px]"
                          style={{ background: "var(--panel-2)" }}
                        >
                          <span className="lab w-[62px] shrink-0" style={{ color: TONE[n.kind] }}>
                            {n.kind}
                          </span>
                          <span style={{ color: "var(--ink-15)" }}>{n.name}</span>
                          <span className="text-[11px]" style={{ color: "var(--ink-3)", fontFamily: "var(--font-mono-jb)" }}>
                            {n.changes.map((c) => `${c.key}: ${String(c.from)} → ${String(c.to)}`).join(" · ")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {diff.edges.length ? (
                    <>
                      <div className="lab mb-2 mt-4">Connections</div>
                      <ul className="flex flex-col gap-[3px]">
                        {diff.edges.slice(0, 12).map((e) => (
                          <li
                            key={`${e.kind}-${e.from}-${e.to}`}
                            className="flex items-baseline gap-2 rounded-md px-2 py-1 text-[12px]"
                            style={{ background: "var(--panel-2)" }}
                          >
                            <span className="lab w-[62px] shrink-0" style={{ color: TONE[e.kind] }}>
                              {e.kind}
                            </span>
                            <span style={{ color: "var(--ink-2)" }}>{e.label}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </>
              ) : null}
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t px-5 py-3" style={{ borderColor: "var(--line)" }}>
          <button
            className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-40"
            style={{ background: "var(--accent)" }}
            disabled={!parsed?.ok}
            onClick={() => apply("replace")}
          >
            Replace the drawing
          </button>
          <button
            className="rounded-lg px-3 py-1.5 text-[12px] font-medium hover:bg-[var(--hover)] disabled:opacity-40"
            style={{ border: "1px solid var(--line-2)", color: "var(--ink-15)" }}
            disabled={!parsed?.ok || !nodes.length}
            onClick={() => apply("merge")}
          >
            Merge into it
          </button>
          <span className="ml-auto max-w-[380px] text-right text-[11px] leading-snug" style={{ color: "var(--ink-3)" }}>
            Merge keeps what the template does not mention: resources it lacks, your positions and sections, and the
            traffic figures the estimate runs on.
          </span>
        </div>
      </div>
    </div>
  );
}
