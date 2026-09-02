"use client";

// Export drawer: every format via download, clipboard, or (through the
// tools) chunked delivery. SVG/PNG render the live React Flow viewport.

import { useMemo, useState } from "react";
import { toPng, toSvg } from "html-to-image";
import { useStore, pricingOf, snapshotOf } from "@/store/useStore";
import { exportAs, EXPORT_FORMATS, type ExportFormat } from "@/engine/exporters";

const EXT: Record<ExportFormat, string> = {
  json: "json",
  markdown: "md",
  mermaid: "mmd",
  cdk: "ts",
};

function download(filename: string, content: string | Blob, type = "text/plain") {
  const blob =
    typeof content === "string" ? new Blob([content], { type }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function captureCanvas(kind: "svg" | "png") {
  const el = document.querySelector<HTMLElement>(".react-flow__viewport");
  if (!el) return;
  if (kind === "svg") {
    const dataUrl = await toSvg(el);
    const res = await fetch(dataUrl);
    download("overhead.svg", await res.blob());
  } else {
    const dataUrl = await toPng(el, { pixelRatio: 2 });
    const res = await fetch(dataUrl);
    download("overhead.png", await res.blob());
  }
}

export function ExportPanel() {
  const panel = useStore((s) => s.exportPanel);
  const setExportPanel = useStore((s) => s.setExportPanel);
  const drawingName = useStore((s) => s.drawingName);
  // Derived in useMemo, not in the selector: the JSON exporter stamps a
  // timestamp, so two getSnapshot() calls would never be equal (React #185).
  const nodes = useStore((s) => s.nodes);
  const edges = useStore((s) => s.edges);
  const containers = useStore((s) => s.containers);
  const sections = useStore((s) => s.sections);
  const traffic = useStore((s) => s.traffic);
  const region = useStore((s) => s.region);
  const content = useMemo(() => {
    if (!panel || panel === "svg") return "";
    try {
      const s = useStore.getState();
      return exportAs(panel, snapshotOf(s), pricingOf(s), drawingName);
    } catch (err) {
      return `// export failed: ${err instanceof Error ? err.message : err}`;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel, drawingName, nodes, edges, containers, sections, traffic, region]);
  const [copied, setCopied] = useState(false);

  const tabs = useMemo(() => [...EXPORT_FORMATS, "svg" as const], []);

  if (!panel) return null;

  return (
    <div className="absolute inset-0 z-50 flex flex-col" style={{ background: "var(--panel)" }}>
      <div className="flex items-center gap-1.5 border-b border-line px-3 py-2">
        <span
          className="mr-1 text-[12px] font-semibold uppercase tracking-wider text-ink-3"
          style={{ fontFamily: "var(--font-archivo)" }}
        >
          Export
        </span>
        {tabs.map((f) => (
          <button
            key={f}
            className="rounded-md px-2 py-0.5 text-[11.5px]"
            style={{
              background: panel === f ? "var(--accent-bg)" : undefined,
              color: panel === f ? "var(--ink-15)" : "var(--ink-3)",
            }}
            onClick={() => setExportPanel(f)}
          >
            {f}
          </button>
        ))}
        <button
          className="ml-auto grid h-6 w-6 place-items-center rounded-[7px] text-ink-3 hover:bg-[var(--hover-2)] hover:text-ink-2"
          onClick={() => setExportPanel(null)}
          aria-label="Close export panel"
        >
          ✕
        </button>
      </div>

      {panel === "svg" ? (
        <div className="flex flex-col gap-3 p-4 text-[13px]">
          <p className="text-ink-2">
            Renders the canvas exactly as drawn — vector SVG or 2× PNG.
          </p>
          <div className="flex gap-2">
            <button
              className="rounded-lg px-3 py-1.5 text-[12px] font-medium hover:bg-[var(--hover)]" style={{ border: "1px solid var(--line-2)", color: "var(--ink-15)" }}
              onClick={() => captureCanvas("svg")}
            >
              Download SVG
            </button>
            <button
              className="rounded-lg px-3 py-1.5 text-[12px] font-medium hover:bg-[var(--hover)]" style={{ border: "1px solid var(--line-2)", color: "var(--ink-15)" }}
              onClick={() => captureCanvas("png")}
            >
              Download PNG
            </button>
          </div>
        </div>
      ) : (
        <>
          <textarea
            readOnly
            value={content}
            className="min-h-0 flex-1 resize-none bg-panel-2 p-3 text-[11px] leading-relaxed outline-none"
            style={{ fontFamily: "var(--font-mono-jb)" }}
          />
          <div className="flex gap-2 border-t border-line p-3">
            <button
              className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-white" style={{ background: "var(--accent)" }}
              onClick={() => download(`${drawingName}.${EXT[panel]}`, content)}
            >
              Download .{EXT[panel]}
            </button>
            <button
              className="rounded-lg px-3 py-1.5 text-[12px] font-medium hover:bg-[var(--hover)]" style={{ border: "1px solid var(--line-2)", color: "var(--ink-15)" }}
              onClick={async () => {
                await navigator.clipboard.writeText(content);
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              }}
            >
              {copied ? "Copied ✓" : "Copy"}
            </button>
            <span className="ml-auto self-center text-[11px] text-ink-3">
              {content.length.toLocaleString("en-US")} chars
            </span>
          </div>
        </>
      )}
    </div>
  );
}
