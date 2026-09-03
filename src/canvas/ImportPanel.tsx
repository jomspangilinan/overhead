"use client";

// Import, built as the mirror of Export: the same dialog, the same named
// list down the left with a line each saying what the thing is, the same
// view of the artefact in the middle, the same action bar underneath.
// Export writes four things and Import reads two of them back, so the two
// dialogs should not look like different products.
//
// The middle box is **editable**. A document does not have to be a file to
// be worth reading · pasting a template out of a terminal, or typing three
// resources by hand, is how this actually gets used, and every path (paste,
// drop, type, pick a file, pick a sample) ends at the same text.
//
// The seeded architectures are a source in the list here, not a dialog of
// their own: a template is an import too, ours in JSON instead of yours in
// YAML.
//
// The extra job Export does not have: a drawing is usually not empty when
// a file arrives, so the pane beside the preview says what the file would
// do to it, and the two buttons are the two honest answers · take the file,
// or take it only where it speaks.
//
// This is the door back through the export. It is not a live sync: nothing
// here watches a repo, and nothing writes to one.

import { useEffect, useMemo, useRef, useState } from "react";
import { useStore, pricingOf, snapshotOf } from "@/store/useStore";
import { useFitDrawing } from "./fitDrawing";
import { getService } from "@/engine/services";
import type { StateSnapshot } from "@/engine/model";
import { importAny, type ImportFormat } from "@/engine/iac/import";
import { onBackspace, onEnter, onTab, type TextEdit } from "./textIndent";
import { applyReconciliation, placeNewNodes, reconcile, type MergeMode } from "@/engine/iac/reconcile";
import { monthlyTotal } from "@/engine/cost";
import { toMoney } from "@/engine/model";

// A template is an import too · it is just our own JSON instead of
// somebody's CloudFormation, so the seeded architectures are a source in
// this list rather than a second dialog of their own.
type Group = "Diagram" | "Build" | "Project" | "Samples";
interface Common {
  id: string;
  label: string;
  blurb: string;
  group: Group;
}
/** A file the user hands over · the entry says how it is read. */
interface FileSource extends Common {
  from: "file";
  kind: ImportFormat;
  accept: string;
  /** Shown in the empty pane · where a file of this kind comes from. */
  where: string;
}
/** One of the seeded architectures · our own JSON, loaded straight in. */
interface SampleSource extends Common {
  from: "sample";
  sample: string;
}
type Source = FileSource | SampleSource;

const BLURB: Record<string, string> = {
  "api-backend": "HTTP API → Lambda → DynamoDB. The smallest thing that's real.",
  "media-pipeline": "CloudFront in front of S3, SQS-fed thumbnail worker.",
  "event-driven": "Cognito, EventBridge, Step Functions, SNS fan-out, VPC-attached workers.",
  "checkout-flow": "A business flow and the AWS behind it, on one canvas · the shapes carry no price.",
};

const FILE_SOURCES: FileSource[] = [
  {
    id: "mermaid",
    from: "file",
    kind: "mermaid",
    label: "Mermaid flowchart",
    accept: ".mmd,.mermaid,.md,.txt",
    group: "Diagram",
    blurb: "A flowchart anybody wrote · read for what it says, and priced.",
    where:
      "From a README, a wiki, mermaid.live, or an agent that writes Mermaid. Labels are matched against the service vocabulary, so `[Lambda worker]` arrives as a priced AWS Lambda; a label that names no service keeps its shape (a diamond is a decision, a cylinder a store) and carries no price. A subgraph titled VPC or a region becomes that container; any other subgraph becomes a section. Mermaid holds no positions, so the drawing is laid out on arrival.",
  },
  {
    id: "cdk",
    from: "file",
    kind: "cdk",
    label: "CDK · TypeScript",
    accept: ".ts,.js,.txt",
    group: "Build",
    blurb: "A stack Overhead wrote comes back · anyone else's: cdk synth.",
    where:
      "The stack Export writes under Build. It carries the drawing in a comment block, so it comes back with its positions, containers, sections and traffic intact · the same round-trip a template gets. Somebody else's stack is a program: it has loops and lookups and does not say what it builds until it runs, so run `cdk synth > template.yaml` in that app and bring the template instead.",
  },
  {
    id: "cloudformation",
    from: "file",
    kind: "cloudformation",
    label: "CloudFormation",
    accept: ".yaml,.yml,.json,.template,.txt",
    group: "Build",
    blurb: "A template becomes the drawing, priced · YAML or JSON.",
    where: "From `cdk synth`, `aws cloudformation get-template`, the console, or a repo. A template Overhead wrote comes back exactly; anyone else's comes back as the resources it models, with the connections read from what references what.",
  },
  {
    id: "overhead",
    from: "file",
    kind: "overhead",
    label: "Overhead file",
    accept: ".json,.txt",
    group: "Project",
    blurb: "A drawing saved from here · positions, frames and settings intact.",
    where: "The JSON that Export writes under Project. Everything comes back as it left, including the parts a template has no place for.",
  },
];

const GROUPS: Group[] = ["Samples", "Diagram", "Build", "Project"];

const TONE: Record<string, string> = {
  added: "var(--good)",
  removed: "var(--bad)",
  changed: "var(--warn)",
  same: "var(--ink-3)",
};

export function ImportPanel({ samples }: { samples: Record<string, StateSnapshot> }) {
  const panel = useStore((s) => s.importPanel);
  const setImportPanel = useStore((s) => s.setImportPanel);
  const loadSnapshot = useStore((s) => s.loadSnapshot);
  const applyAutoLayout = useStore((s) => s.applyAutoLayout);
  const notify = useStore((s) => s.notify);
  const region = useStore((s) => s.region);
  const nodes = useStore((s) => s.nodes);
  const setDrawingName = useStore((s) => s.setDrawingName);
  const fitDrawing = useFitDrawing();
  const fileInput = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  // The box is controlled by the store, so an indent edit has to put the
  // caret back itself once React has written the new text.
  const caret = useRef<[number, number] | null>(null);
  const [dragging, setDragging] = useState(false);

  const sources: Source[] = useMemo(
    () => [
      ...Object.keys(samples).map<Source>((name) => ({
        id: `sample:${name}`,
        from: "sample",
        sample: name,
        label: name,
        group: "Samples",
        blurb: BLURB[name] ?? "A seeded architecture.",
      })),
      ...FILE_SOURCES,
    ],
    [samples],
  );

  const parsed = useMemo(() => {
    if (!panel?.template) return null;
    // No format pinned = whatever the file turns out to be; the nav follows.
    return importAny(panel.template, { region, format: panel.format });
  }, [panel?.template, panel?.format, region]);

  // The selected entry is what the user picked, else what the file turned
  // out to be · dropping a saved drawing should not leave CloudFormation lit.
  const selectedId =
    panel?.source ?? (panel?.format ?? parsed?.format ?? "cloudformation");
  const spec = sources.find((s) => s.id === selectedId) ?? FILE_SOURCES[0];
  const fileSpec: FileSource = spec.from === "file" ? spec : FILE_SOURCES[0];

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

  useEffect(() => {
    if (!caret.current || !box.current) return;
    box.current.setSelectionRange(caret.current[0], caret.current[1]);
    caret.current = null;
  }, [panel?.template]);

  if (!panel) return null;

  /** Every path that changes the text goes through here · typing over a
   *  sample makes it your text, not that sample, and the pinned format goes
   *  with it so pasting a template into a sample is read as a template. A
   *  format the user picked themselves stays pinned, so the mismatch is
   *  still reported rather than guessed away. */
  const write = (template: string) => {
    const wasSample = panel.source?.startsWith("sample:");
    setImportPanel({
      ...panel,
      template,
      fileName: "",
      drawingName: undefined,
      ...(wasSample ? { format: undefined, source: undefined } : {}),
    });
  };

  const edit = (next: TextEdit) => {
    caret.current = [next.selStart, next.selEnd];
    write(next.value);
  };

  const take = async (file: File) => {
    setImportPanel({ fileName: file.name, template: await file.text() });
  };

  /** Picking a source · a sample loads straight in as its own JSON, a file
   *  source just pins how the next file is read. */
  const pick = (s: Source) => {
    if (!panel) return;
    if (s.from === "sample") {
      setImportPanel({
        fileName: `${s.sample}.json`,
        template: JSON.stringify(samples[s.sample], null, 2),
        format: "overhead",
        source: s.id,
        drawingName: s.sample,
      });
      return;
    }
    // Keep a loaded file when the user is only re-reading it as the other
    // format; drop a sample, which was never a file of theirs.
    const keep = panel.source?.startsWith("sample:") ? "" : panel.template;
    setImportPanel({
      fileName: keep ? panel.fileName : "",
      template: keep,
      format: s.kind,
      source: s.id,
    });
  };

  const apply = (mode: MergeMode) => {
    if (!parsed?.ok || !diff) return;
    const current = snapshotOf(useStore.getState());
    const next = applyReconciliation(current, parsed.snapshot, diff, mode, parsed.stated);
    const addedIds = diff.nodes.filter((n) => n.kind === "added").map((n) => diff.matched[n.id] ?? n.id);
    loadSnapshot(mode === "merge" ? placeNewNodes(next, addedIds) : next);
    // What decides this is whether the document carried the drawing, not what
    // format it was: our own template and our own stack both bring positions,
    // and re-arranging those would throw away the thing that came back.
    if (mode === "replace" && parsed.report.source !== "overhead") applyAutoLayout();
    if (mode === "replace" && panel.drawingName) setDrawingName(panel.drawingName);
    setImportPanel(null);
    // Two frames, not one: React Flow fits what it has measured, and after a
    // wholesale load the new nodes are not measured until the frame after the
    // one that rendered them · fitting on the first frame left the drawing at
    // 100% with its top cut off.
    requestAnimationFrame(() => requestAnimationFrame(() => fitDrawing({ duration: 150 })));
    notify(
      mode === "replace"
        ? `Imported ${parsed.report.nodes} resources from ${panel.fileName}`
        : `Merged ${panel.fileName}: ${diff.counts.added} added · ${diff.counts.changed} changed · ${diff.counts.removed} left alone`,
    );
  };

  const rows = diff ? diff.nodes.filter((n) => n.kind !== "same") : [];
  const hasFile = !!panel.template;

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center"
      style={{ background: "rgba(5, 7, 10, 0.55)" }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) setImportPanel(null);
      }}
      role="dialog"
      aria-modal
      aria-label="Import"
    >
      <div className="glass flex h-[620px] max-h-[calc(100vh-64px)] w-[900px] max-w-[calc(100vw-48px)] flex-col rounded-2xl">
        <div className="flex items-baseline justify-between border-b px-5 py-3.5" style={{ borderColor: "var(--line)" }}>
          <div>
            <h2 className="text-[15px] font-semibold">Import</h2>
            <p className="text-[11.5px]" style={{ color: "var(--ink-3)" }}>
              {panel.fileName || (hasFile ? "pasted" : "nothing loaded")} · everything is read in this tab, nothing is uploaded.
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

        <div className="flex min-h-0 flex-1">
          <nav className="w-[248px] shrink-0 overflow-y-auto border-r py-2" style={{ borderColor: "var(--line)" }} aria-label="Import sources">
            {GROUPS.map((g) => (
              <div key={g} className="mb-1">
                <div className="lab px-4 pb-1 pt-2">{g}</div>
                {sources
                  .filter((s) => s.group === g)
                  .map((s) => {
                    const on = s.id === spec.id;
                    return (
                      <button
                        key={s.id}
                        className="block w-full px-4 py-1.5 text-left hover:bg-[var(--hover)]"
                        style={{ background: on ? "var(--accent-bg)" : undefined }}
                        onClick={() => pick(s)}
                        aria-pressed={on}
                      >
                        <div className="flex items-center gap-1.5">
                          {s.from === "sample" ? (
                            <span className="flex items-center gap-[3px]">
                              {samples[s.sample]?.nodes.slice(0, 4).map((n) => (
                                <svg key={n.id} width="13" height="13" aria-hidden>
                                  <use href={`#${getService(n.service)?.icon ?? ""}`} width="13" height="13" />
                                </svg>
                              ))}
                            </span>
                          ) : null}
                          <span className="text-[12.5px] font-medium" style={{ color: on ? "var(--accent-ink)" : "var(--ink-15)" }}>
                            {s.label}
                          </span>
                        </div>
                        <div className="mt-0.5 text-[10.5px] leading-snug" style={{ color: "var(--ink-3)" }}>
                          {s.blurb}
                        </div>
                      </button>
                    );
                  })}
              </div>
            ))}
          </nav>

          <div
            className="flex min-h-0 min-w-0 flex-1 flex-col"
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes("Files")) {
                e.preventDefault();
                setDragging(true);
              }
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) void take(file);
            }}
          >
            {/* One layout for every way a file arrives · paste into it, drop
                on it, type in it, or pick a file. The box is the artefact,
                the way Export previews what it writes, only writable. */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b px-4 py-2.5 text-[11.5px]" style={{ borderColor: "var(--line)", color: "var(--ink-2)" }}>
              {parsed?.ok ? (
                <>
                  <span>
                    <strong style={{ fontFamily: "var(--font-mono-jb)" }}>{parsed.report.nodes}</strong> resources ·{" "}
                    <strong style={{ fontFamily: "var(--font-mono-jb)" }}>{parsed.report.edges}</strong> connections ·{" "}
                    <strong style={{ fontFamily: "var(--font-mono-jb)" }}>{parsed.report.containers}</strong> containers
                  </span>
                  {estimate !== null ? (
                    <span style={{ color: "var(--ink)" }}>
                      <strong style={{ fontFamily: "var(--font-mono-jb)" }}>${toMoney(estimate).toFixed(2)}</strong>/month
                    </span>
                  ) : null}
                  <span style={{ color: "var(--ink-3)" }}>
                    {parsed.report.source === "overhead" ? "written by Overhead" : "read structurally"}
                  </span>
                </>
              ) : (
                <span style={{ color: "var(--ink-3)" }}>
                  {spec.from === "sample" ? spec.blurb : `Paste, drop or type a ${fileSpec.label} document below.`}
                </span>
              )}
              <button
                className="ml-auto rounded-md px-2 py-0.5 text-[11px] hover:bg-[var(--hover)]"
                style={{ border: "1px solid var(--line-2)", color: "var(--ink-2)" }}
                onClick={() => fileInput.current?.click()}
              >
                Choose a file
              </button>
              {hasFile ? (
                <button
                  className="rounded-md px-2 py-0.5 text-[11px] hover:bg-[var(--hover)]"
                  style={{ border: "1px solid var(--line-2)", color: "var(--ink-2)" }}
                  onClick={() => setImportPanel({ fileName: "", template: "", format: panel.format, source: panel.source })}
                >
                  Clear
                </button>
              ) : null}
            </div>

            <div className="flex min-h-0 flex-1">
              <textarea
                ref={box}
                value={panel.template}
                spellCheck={false}
                onChange={(e) => write(e.target.value)}
                onKeyDown={(e) => {
                  // YAML is whitespace, so the box has to keep it: Enter
                  // carries the indent, Tab is a level and not the next
                  // control, Backspace in the indent goes back a level.
                  const el = e.currentTarget;
                  const at = [el.value, el.selectionStart, el.selectionEnd] as const;
                  if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
                    e.preventDefault();
                    edit(onEnter(...at));
                  } else if (e.key === "Tab" && !e.metaKey && !e.ctrlKey && !e.altKey) {
                    e.preventDefault();
                    edit(onTab(...at, e.shiftKey));
                  } else if (e.key === "Backspace" && !e.metaKey && !e.ctrlKey && !e.altKey) {
                    const next = onBackspace(...at);
                    if (next) {
                      e.preventDefault();
                      edit(next);
                    }
                  }
                }}
                aria-label="Template or Overhead file"
                placeholder={`Paste a ${fileSpec.label} document here, drop a file anywhere in this pane, or start typing.\n\n${fileSpec.where}`}
                className="min-h-0 min-w-0 flex-1 resize-none p-4 text-[11px] leading-relaxed outline-none"
                style={{
                  background: "var(--panel-2)",
                  fontFamily: "var(--font-mono-jb)",
                  outline: dragging ? "2px dashed var(--accent)" : "none",
                  outlineOffset: -8,
                }}
              />
              <div className="flex w-[300px] shrink-0 flex-col overflow-y-auto border-l px-4 py-3" style={{ borderColor: "var(--line)" }}>
                {!hasFile ? (
                  <>
                    <div className="lab pb-1.5">Nothing to read yet</div>
                    <p className="text-[11.5px] leading-relaxed" style={{ color: "var(--ink-3)" }}>
                      Pick a sample on the left, paste a document, or drop a file. What it would do to this drawing
                      appears here before anything happens.
                    </p>
                  </>
                ) : !parsed?.ok ? (
                  <>
                    <div className="lab pb-1.5" style={{ color: parsed?.code === "cdk_source" ? "var(--warn)" : "var(--bad)" }}>
                      {parsed?.code === "cdk_source" ? "Synthesise it first" : "Cannot read this"}
                    </div>
                    <p className="text-[11.5px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
                      {parsed?.message ?? "That document could not be read."}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="lab pb-1.5">Against this drawing</div>
                    {!nodes.length ? (
                      <p className="text-[11.5px] leading-relaxed" style={{ color: "var(--ink-3)" }}>
                        The canvas is empty · this becomes the drawing.
                      </p>
                    ) : rows.length === 0 && !diff?.edges.length ? (
                      <p className="text-[11.5px] leading-relaxed" style={{ color: "var(--ink-3)" }}>
                        Nothing differs · this and the drawing already agree.
                      </p>
                    ) : (
                      <ul className="flex flex-col gap-[3px]">
                        {rows.map((n) => (
                          <li key={`${n.kind}-${n.id}`} className="rounded-md px-2 py-1 text-[12px]" style={{ background: "var(--panel-2)" }}>
                            <div className="flex items-baseline gap-2">
                              <span className="lab shrink-0" style={{ color: TONE[n.kind] }}>
                                {n.kind}
                              </span>
                              <span className="truncate" style={{ color: "var(--ink-15)" }}>
                                {n.name}
                              </span>
                            </div>
                            {n.changes.length ? (
                              <div className="mt-0.5 text-[10.5px] leading-snug" style={{ color: "var(--ink-3)", fontFamily: "var(--font-mono-jb)" }}>
                                {n.changes.map((c) => `${c.key}: ${String(c.from)} → ${String(c.to)}`).join(" · ")}
                              </div>
                            ) : null}
                          </li>
                        ))}
                        {diff?.edges.slice(0, 10).map((e) => (
                          <li key={`${e.kind}-${e.from}-${e.to}`} className="flex items-baseline gap-2 rounded-md px-2 py-1 text-[12px]" style={{ background: "var(--panel-2)" }}>
                            <span className="lab shrink-0" style={{ color: TONE[e.kind] }}>
                              {e.kind}
                            </span>
                            <span className="truncate" style={{ color: "var(--ink-2)" }}>
                              {e.label}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {parsed.report.notes.map((note) => (
                      <p key={note} className="mt-2 text-[10.5px] leading-relaxed" style={{ color: "var(--ink-3)" }}>
                        {note}
                      </p>
                    ))}
                    {parsed.report.skipped.length ? (
                      <p className="mt-2 text-[10.5px] leading-relaxed" style={{ color: "var(--ink-3)" }}>
                        Not modelled here: {parsed.report.skipped.map((s) => `${s.type} ×${s.count}`).join(", ")}
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t px-4 py-3" style={{ borderColor: "var(--line)" }}>
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
              <span className="ml-auto max-w-[360px] text-right text-[11px] leading-snug" style={{ color: "var(--ink-3)" }}>
                Merge keeps what the file does not mention: resources it lacks, your positions and sections, and the
                traffic figures the estimate runs on.
              </span>
            </div>
            <input
              ref={fileInput}
              type="file"
              accept={fileSpec.accept}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void take(file);
                e.target.value = "";
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
