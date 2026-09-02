"use client";

// First-visit banner: how to try this with an agent, dismissible.

import { useEffect, useState } from "react";
import { useStore } from "@/store/useStore";

const KEY = "overhead-howto-dismissed";

export function HowTo() {
  const [show, setShow] = useState(false);
  const empty = useStore((s) => s.nodes.length === 0);

  useEffect(() => {
    try {
      setShow(localStorage.getItem(KEY) !== "1");
    } catch {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-[58px] z-[4] flex justify-center px-4">
      <div className="glass pointer-events-auto flex max-w-2xl items-start gap-3 rounded-[12px] px-4 py-3">
        <div className="text-[13px] leading-relaxed text-ink-2">
          {empty ? (
            <>
              <strong className="text-ink">Empty canvas.</strong> Press A to add a
              service, open Templates from the rail, drop a Cost Explorer CSV to
              price what you already run · or open this page in the ChatGPT
              desktop app and describe what to build.
            </>
          ) : (
            <>
              <strong className="text-ink">Bring your agent:</strong> open this
              page in the ChatGPT desktop app and describe an architecture · it
              builds, prices and audits it live. Drop a Cost Explorer CSV anywhere
              to price what you already run. Its tools: bottom bar.
            </>
          )}
        </div>
        {(
          <button
            className="rounded border border-line px-1.5 text-[12px] text-ink-3 hover:bg-panel-2"
            aria-label="Dismiss"
            onClick={() => {
              setShow(false);
              try {
                localStorage.setItem(KEY, "1");
              } catch {}
            }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
