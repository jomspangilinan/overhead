"use client";

// Export, as a dialog you can read: the formats are a named list with a
// line each saying what the file is *for*, and the pane beside it shows the
// actual artefact before you commit to a download. The old panel was a row
// of lower-case tabs over a textarea, wedged into the right dock · which
// also meant Export did nothing at all when that dock was collapsed.
//
// Pictures (PNG · SVG · PDF) render the whole drawing through
// exportImage.ts, not the slice of it that happens to be on screen.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { useStore, pricingOf, snapshotOf } from "@/store/useStore";
import { exportAs, type ExportFormat } from "@/engine/exporters";
import { captureDrawing, dataUrlToBlob, bytesOf, jpegToPdf } from "./exportImage";
import { Icon } from "./Icon";

export type ExportKind = ExportFormat | "png" | "svg" | "pdf";

const PICTURES: ExportKind[] = ["png", "svg", "pdf"];

interface Spec {
  kind: ExportKind;
  label: string;
  ext: string;
  blurb: string;
  group: "Picture" | "Document" | "Build";
}

const SPECS: Spec[] = [
  { kind: "png", label: "PNG", ext: "png", group: "Picture", blurb: "The drawing as a raster image · paste into a deck or a ticket." },
  { kind: "svg", label: "SVG", ext: "svg", group: "Picture", blurb: "The same picture as vectors · scales to any size, editable." },
  { kind: "pdf", label: "PDF", ext: "pdf", group: "Picture", blurb: "One page, sized to the drawing · attach it to the proposal." },
  { kind: "markdown", label: "Markdown", ext: "md", group: "Document", blurb: "Assumptions, the cost table, findings with links, diagram inline." },
  { kind: "mermaid", label: "Mermaid", ext: "mmd", group: "Document", blurb: "A flowchart for a README or a PR · labels carry the monthly cost." },
  { kind: "cdk", label: "CDK · TypeScript", ext: "ts", group: "Build", blurb: "One stack, one construct per resource · cdk synth passes." },
  { kind: "json", label: "JSON", ext: "json", group: "Build", blurb: "This drawing, with the pricing snapshot · reloads here or via a tool." },
];

const GROUPS: Spec["group"][] = ["Picture", "Document", "Build"];

function download(filename: string, content: string | Blob, type = "text/plain") {
  const blob = typeof content === "string" ? new Blob([content], { type }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportPanel() {
  const panel = useStore((s) => s.exportPanel);
  const setExportPanel = useStore((s) => s.setExportPanel);
  const drawingName = useStore((s) => s.drawingName);
  const notify = useStore((s) => s.notify);
  const containers = useStore((s) => s.containers);
  const sections = useStore((s) => s.sections);
  const nodes = useStore((s) => s.nodes);
  const edges = useStore((s) => s.edges);
  const traffic = useStore((s) => s.traffic);
  const region = useStore((s) => s.region);
  const { getNodes } = useReactFlow();

  const [transparent, setTransparent] = useState(false);
  const [scale, setScale] = useState(2);
  const [preview, setPreview] = useState<{ dataUrl: string; width: number; height: number } | null>(null);
  const [rendering, setRendering] = useState(false);
  const [copied, setCopied] = useState(false);
  const seq = useRef(0);

  const spec = SPECS.find((s) => s.kind === panel);
  const isPicture = !!spec && PICTURES.includes(spec.kind);

  // Frames the user resized past their contents · the picture has to hold
  // them too, and node bounds alone would clip them.
  const frames = useMemo(
    () => [
      ...containers.flatMap((c) => (c.bounds ? [c.bounds] : [])),
      ...sections.flatMap((x) => (x.bounds ? [x.bounds] : [])),
    ],
    [containers, sections],
  );

  // Derived in a memo, not in the selector: the JSON exporter stamps a
  // timestamp, so two getSnapshot() calls would never be equal (React #185).
  const content = useMemo(() => {
    if (!spec || isPicture) return "";
    try {
      const s = useStore.getState();
      return exportAs(spec.kind as ExportFormat, snapshotOf(s), pricingOf(s), drawingName);
    } catch (err) {
      return `// export failed: ${err instanceof Error ? err.message : err}`;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec, isPicture, drawingName, nodes, edges, containers, sections, traffic, region]);

  const render = useCallback(
    async (kind: "png" | "jpeg", pixels: number) => {
      const bg = transparent && kind === "png" ? null : "#0B0D10";
      return captureDrawing(kind, getNodes(), { frames, background: bg, scale: pixels });
    },
    [frames, getNodes, transparent],
  );

  // A preview of the actual picture · rendered once per format/option change.
  useEffect(() => {
    if (!isPicture) {
      setPreview(null);
      return;
    }
    const mine = ++seq.current;
    setRendering(true);
    void render("png", 1)
      .then((shot) => {
        if (mine === seq.current) setPreview(shot);
      })
      .catch(() => {
        if (mine === seq.current) setPreview(null);
      })
      .finally(() => {
        if (mine === seq.current) setRendering(false);
      });
  }, [isPicture, panel, render]);

  useEffect(() => {
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExportPanel(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel, setExportPanel]);

  if (!panel || !spec) return null;
  const filename = `${drawingName || "overhead"}.${spec.ext}`;

  const savePicture = async () => {
    try {
      if (spec.kind === "svg") {
        const shot = await captureDrawing("svg", getNodes(), { frames, background: transparent ? null : "#0B0D10" });
        if (shot) download(filename, await dataUrlToBlob(shot.dataUrl));
      } else if (spec.kind === "png") {
        const shot = await render("png", scale);
        if (shot) download(filename, await dataUrlToBlob(shot.dataUrl));
      } else {
        const shot = await render("jpeg", scale);
        if (shot) download(filename, jpegToPdf(bytesOf(shot.dataUrl), shot.width, shot.height, scale, drawingName), "application/pdf");
      }
      notify(`Saved ${filename}`);
    } catch (err) {
      notify(`Export failed: ${err instanceof Error ? err.message : err}`, "warn");
    }
  };

  const flash = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center"
      style={{ background: "rgba(5, 7, 10, 0.55)" }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) setExportPanel(null);
      }}
      role="dialog"
      aria-modal
      aria-label="Export"
    >
      <div className="glass flex h-[620px] max-h-[calc(100vh-64px)] w-[900px] max-w-[calc(100vw-48px)] flex-col rounded-2xl">
        <div className="flex items-baseline justify-between border-b px-5 py-3.5" style={{ borderColor: "var(--line)" }}>
          <div>
            <h2 className="text-[15px] font-semibold">Export</h2>
            <p className="text-[11.5px]" style={{ color: "var(--ink-3)" }}>
              {nodes.length} resources · everything is generated in this tab, nothing is uploaded.
            </p>
          </div>
          <button
            className="rounded-md px-2 py-1 text-[12px] hover:bg-[var(--hover)]"
            style={{ color: "var(--ink-3)" }}
            onClick={() => setExportPanel(null)}
          >
            esc
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          <nav className="w-[248px] shrink-0 overflow-y-auto border-r py-2" style={{ borderColor: "var(--line)" }} aria-label="Export formats">
            {GROUPS.map((g) => (
              <div key={g} className="mb-1">
                <div className="lab px-4 pb-1 pt-2">{g}</div>
                {SPECS.filter((s) => s.group === g).map((s) => (
                  <button
                    key={s.kind}
                    className="block w-full px-4 py-1.5 text-left hover:bg-[var(--hover)]"
                    style={{ background: s.kind === panel ? "var(--accent-bg)" : undefined }}
                    onClick={() => setExportPanel(s.kind)}
                    aria-pressed={s.kind === panel}
                  >
                    <div className="text-[12.5px] font-medium" style={{ color: s.kind === panel ? "var(--accent-ink)" : "var(--ink-15)" }}>
                      {s.label}
                    </div>
                    <div className="mt-0.5 text-[10.5px] leading-snug" style={{ color: "var(--ink-3)" }}>
                      {s.blurb}
                    </div>
                  </button>
                ))}
              </div>
            ))}
          </nav>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {isPicture ? (
              <div className="flex min-h-0 flex-1 items-center justify-center p-4" style={{ background: "var(--panel-2)" }}>
                {rendering && !preview ? (
                  <span className="text-[11.5px]" style={{ color: "var(--ink-3)" }}>
                    Rendering the drawing…
                  </span>
                ) : preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={preview.dataUrl}
                    alt="Export preview"
                    className="max-h-full max-w-full rounded-md"
                    style={{ border: "1px solid var(--line)", opacity: rendering ? 0.5 : 1 }}
                  />
                ) : (
                  <span className="text-[11.5px]" style={{ color: "var(--ink-3)" }}>
                    Nothing on the canvas to picture yet.
                  </span>
                )}
              </div>
            ) : (
              <textarea
                readOnly
                value={content}
                aria-label={`${spec.label} export`}
                className="min-h-0 flex-1 resize-none p-4 text-[11px] leading-relaxed outline-none"
                style={{ background: "var(--panel-2)", fontFamily: "var(--font-mono-jb)" }}
              />
            )}

            <div className="flex flex-wrap items-center gap-2 border-t px-4 py-3" style={{ borderColor: "var(--line)" }}>
              <button
                className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-white"
                style={{ background: "var(--accent)" }}
                onClick={() => (isPicture ? void savePicture() : download(filename, content))}
              >
                Download {filename}
              </button>
              <button
                className="rounded-lg px-3 py-1.5 text-[12px] font-medium hover:bg-[var(--hover)]"
                style={{ border: "1px solid var(--line-2)", color: "var(--ink-15)" }}
                onClick={async () => {
                  try {
                    if (!isPicture) {
                      await navigator.clipboard.writeText(content);
                    } else {
                      const shot = spec.kind === "svg" ? await captureDrawing("svg", getNodes(), { frames, background: transparent ? null : "#0B0D10" }) : await render("png", scale);
                      if (!shot) return;
                      if (spec.kind === "svg") await navigator.clipboard.writeText(decodeURIComponent(shot.dataUrl.replace(/^data:image\/svg\+xml;charset=utf-8,/, "")));
                      else await navigator.clipboard.write([new ClipboardItem({ "image/png": await dataUrlToBlob(shot.dataUrl) })]);
                    }
                    flash();
                  } catch {
                    notify("The browser refused the clipboard · use Download instead", "warn");
                  }
                }}
              >
                {copied ? "Copied ✓" : spec.kind === "pdf" ? "Copy as image" : "Copy"}
              </button>

              {isPicture && spec.kind !== "svg" ? (
                <label className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--ink-3)" }}>
                  Scale
                  <select
                    className="rounded-md px-1.5 py-1 text-[11px] outline-none"
                    style={{ background: "var(--panel-2)", border: "1px solid var(--line-2)", color: "var(--ink-2)" }}
                    value={scale}
                    onChange={(e) => setScale(Number(e.target.value))}
                  >
                    {[1, 2, 3].map((n) => (
                      <option key={n} value={n}>
                        {n}×
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {isPicture && spec.kind !== "pdf" ? (
                <label className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--ink-3)" }}>
                  <input type="checkbox" checked={transparent} onChange={(e) => setTransparent(e.target.checked)} />
                  Transparent background
                </label>
              ) : null}

              <span className="ml-auto flex items-center gap-1.5 text-[11px]" style={{ color: "var(--ink-3)" }}>
                <Icon name="export" size={12} />
                {isPicture
                  ? preview
                    ? `${Math.round(preview.width * (spec.kind === "svg" ? 1 : scale))} × ${Math.round(preview.height * (spec.kind === "svg" ? 1 : scale))} px`
                    : "not rendered yet"
                  : `${content.length.toLocaleString("en-US")} chars`}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
