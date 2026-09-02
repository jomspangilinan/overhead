"use client";

// One transient chip over the canvas: a refused drop and its rule, a frame
// that was just created, a node that changed container. Replaces alerts.

import { useEffect } from "react";
import { useStore } from "@/store/useStore";

export function Notice() {
  const notice = useStore((s) => s.notice);
  const clear = useStore((s) => s.clearNotice);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(clear, notice.tone === "info" ? 2200 : 4200);
    return () => clearTimeout(t);
  }, [notice, clear]);

  if (!notice) return null;
  const color = notice.tone === "warn" ? "var(--warn)" : notice.tone === "bad" ? "var(--bad)" : "var(--ink-15)";
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[68px] z-[9] flex justify-center px-4">
      <div
        className="glass pointer-events-auto max-w-[520px] rounded-lg px-3 py-1.5 text-[11.5px] leading-snug"
        style={{ color, borderColor: notice.tone === "info" ? undefined : color }}
        role="status"
        onClick={clear}
      >
        {notice.message}
      </div>
    </div>
  );
}
