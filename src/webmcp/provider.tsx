"use client";

import { useEffect, useState } from "react";
import { registerPipeProof, type RegisterOutcome } from "./register";

type Status = "checking" | RegisterOutcome | "error";

const STATUS_TEXT: Record<Status, string> = {
  checking: "Checking for WebMCP…",
  registered: "1 tool live · overhead_ping",
  "no-model-context":
    "No modelContext API in this browser — open in the ChatGPT desktop browser, or Chrome with #enable-webmcp-testing",
  "in-iframe": "Running in an iframe — tools are invisible here",
  error: "Tool registration threw — check the console",
};

/**
 * Mounted once at the root layout. Registers tools after hydration,
 * in the top-level document, via the imperative API only.
 */
export function WebMCPProvider() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    let cancelled = false;
    registerPipeProof()
      .then((outcome) => {
        if (!cancelled) setStatus(outcome);
      })
      .catch((err) => {
        console.error("WebMCP registration failed:", err);
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      data-status={status}
      className={`fixed bottom-4 right-4 z-50 rounded-full border px-4 py-1.5 font-mono text-xs shadow-sm ${
        status === "registered"
          ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
          : status === "checking"
            ? "border-zinc-300 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
            : "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
      }`}
    >
      {STATUS_TEXT[status]}
    </div>
  );
}
