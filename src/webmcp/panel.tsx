"use client";

// The live tool panel: makes dynamic registration visible. Driven by the
// local registry (mirroring registerTool/abort), so the count ticks when
// scenario tools appear and disappear.

import { useEffect, useState } from "react";
import { liveTools, onToolChange, type RegisteredTool } from "./toolRegistry";
import type { RegisterOutcome } from "./register";

export function ToolPanel({ outcome }: { outcome: RegisterOutcome | "checking" | "error" }) {
  const [tools, setTools] = useState<RegisteredTool[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setTools(liveTools());
    return onToolChange(() => setTools(liveTools()));
  }, []);

  const dynamicCount = tools.filter((t) => t.dynamic).length;

  const label =
    outcome === "registered"
      ? `${tools.length} tools live${dynamicCount ? ` · ${dynamicCount} scenario` : ""}`
      : outcome === "checking"
        ? "Checking for WebMCP…"
        : outcome === "in-iframe"
          ? "In an iframe — tools invisible"
          : outcome === "error"
            ? "Tool registration threw"
            : "No WebMCP in this browser — try the ChatGPT desktop app or Chrome with #enable-webmcp-testing";

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-1.5">
      {open && tools.length > 0 ? (
        <div className="max-h-72 w-64 overflow-y-auto rounded-lg border border-rule bg-surface p-2 shadow-lg">
          {tools.map((t) => (
            <div
              key={t.name}
              className="flex items-center gap-1.5 rounded px-1.5 py-1 text-[11px] hover:bg-surface-2"
              title={t.description}
            >
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${t.dynamic ? "bg-saving" : "bg-accent"}`}
              />
              <span style={{ fontFamily: "var(--font-plex-mono)" }}>{t.name}</span>
            </div>
          ))}
        </div>
      ) : null}
      <button
        onClick={() => setOpen((o) => !o)}
        data-status={outcome}
        className={`rounded-full border px-4 py-1.5 text-xs shadow-sm ${
          outcome === "registered"
            ? "border-rule bg-surface text-ink"
            : "border-finding bg-surface text-finding"
        }`}
        style={{ fontFamily: "var(--font-plex-mono)" }}
      >
        {label}
      </button>
    </div>
  );
}
