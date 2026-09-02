"use client";

// The agent strip. Makes WebMCP's dynamic registration visible: the count
// ticks up by four the moment a scenario opens and back down when it closes,
// and the last three tool calls scroll past on the right.

import { useEffect, useState } from "react";
import {
  liveTools,
  onToolChange,
  onCall,
  recentCalls,
  type RegisteredTool,
  type ToolCall,
} from "./toolRegistry";
import type { RegisterOutcome } from "./register";

export function ToolPanel({
  outcome,
}: {
  outcome: RegisterOutcome | "checking" | "error";
}) {
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
    <>
      {open && tools.length > 0 ? (
        <div
          className="glass fixed z-[9] max-h-72 w-64 overflow-y-auto rounded-[15px] p-2"
          style={{ left: 80, bottom: 56 }}
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

      <footer
        className="glass fixed z-[5] flex items-center gap-[11px] overflow-hidden rounded-[10px] px-[13px] text-[11.5px] text-ink-2"
        style={{ left: 80, right: 16, bottom: 16, height: 32 }}
      >
        <button
          className="flex items-center gap-[11px]"
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
              <b className="font-medium" style={{ color: "var(--ink-15)" }}>
                WebMCP
              </b>{" "}
              ·{" "}
              <span
                className="font-semibold"
                style={{
                  fontFamily: "var(--font-mono-jb)",
                  color: "var(--accent-ink)",
                }}
              >
                {tools.length}
              </span>{" "}
              tools live
              {dynamicCount
                ? ` · ${dynamicCount} while a scenario is open`
                : " · +4 while a scenario is open"}
            </span>
          ) : (
            <span style={{ color: "var(--warn)" }}>
              {outcome === "checking"
                ? "Checking for WebMCP…"
                : outcome === "in-iframe"
                  ? "In an iframe — tools invisible"
                  : outcome === "error"
                    ? "Tool registration threw — see console"
                    : "No WebMCP here — open in the ChatGPT desktop app, or Chrome with #enable-webmcp-testing"}
            </span>
          )}
        </button>

        <div
          className="ml-auto flex gap-[15px] whitespace-nowrap text-[10.5px]"
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
      </footer>
    </>
  );
}
