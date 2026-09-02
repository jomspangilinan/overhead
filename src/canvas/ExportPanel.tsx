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
  const content = useStore((s) => {
    if (!s.exportPanel || s.exportPanel === "svg") return "";
    try {
      return exportAs(s.exportPanel, snapshotOf(s), pricingOf(s));
    } catch (err) {
      return `// export failed: ${err instanceof Error ? err.message : err}`;
    }
  });
  const [copied, setCopied] = useState(false);

  const tabs = useMemo(() => [...EXPORT_FORMATS, "svg" as const], []);

  if (!panel) return null;

  return (
    <div className="absolute inset-y-0 right-0 z-50 flex w-[420px] max-w-full flex-col border-l border-rule bg-surface shadow-xl">
      <div className="flex items-center gap-1.5 border-b border-rule px-3 py-2">
        <span
          className="mr-1 text-[12px] font-semibold uppercase tracking-wider text-ink-3"
          style={{ fontFamily: "var(--font-archivo)" }}
        >
          Export
        </span>
        {tabs.map((f) => (
          <button
            key={f}
            className={`rounded px-2 py-0.5 text-[11.5px] ${
              panel === f ? "bg-accent text-white" : "border border-rule hover:bg-surface-2"
            }`}
            onClick={() => setExportPanel(f)}
          >
            {f}
          </button>
        ))}
        <button
          className="ml-auto rounded border border-rule px-2 py-0.5 text-[12px] hover:bg-surface-2"
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
              className="rounded border border-rule px-3 py-1.5 hover:bg-surface-2"
              onClick={() => captureCanvas("svg")}
            >
              Download SVG
            </button>
            <button
              className="rounded border border-rule px-3 py-1.5 hover:bg-surface-2"
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
            className="min-h-0 flex-1 resize-none bg-surface-2 p-3 text-[11px] leading-relaxed outline-none"
            style={{ fontFamily: "var(--font-plex-mono)" }}
          />
          <div className="flex gap-2 border-t border-rule p-3">
            <button
              className="rounded bg-accent px-3 py-1.5 text-[12.5px] font-semibold text-white"
              onClick={() => download(`overhead.${EXT[panel]}`, content)}
            >
              Download .{EXT[panel]}
            </button>
            <button
              className="rounded border border-rule px-3 py-1.5 text-[12.5px] hover:bg-surface-2"
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
