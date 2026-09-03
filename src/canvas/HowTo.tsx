"use client";

// First-visit banner: how to try this with an agent.
//
// It gets out of the way by itself. Two ways, whichever comes first:
//
//   You start working · the first press on the canvas dismisses it, because
//   somebody who is already dragging a resource has stopped reading.
//   Anything else would be a banner competing with the thing it is about.
//
//   You do not · it fades out after LINGER. Not three seconds: that is less
//   than the sentence takes to read, so it would be a banner nobody has ever
//   read, which is worse than no banner. Long enough to read once, short
//   enough that it is gone before it is furniture.
//
// Either way the dismissal is remembered, so it is a first-visit banner and
// not a recurring one · and the fade is a real transition rather than a
// disappearance, so the eye follows it leaving instead of noticing a gap.

import { useEffect, useState } from "react";
import { useStore } from "@/store/useStore";

const KEY = "overhead-howto-dismissed";
/** Roughly the time to read it once, at an unhurried pace. */
const LINGER = 9000;
const FADE = 400;

export function HowTo() {
  const [show, setShow] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const empty = useStore((s) => s.nodes.length === 0);
  // the scenario banner and its change list own this strip while a fork is
  // open · two panels stacked on the same pixels read as a glitch
  const forked = useStore((s) => !!s.scenario);
  const tracing = useStore((s) => s.tool === "trace" || !!s.traceIds?.length);

  useEffect(() => {
    try {
      setShow(localStorage.getItem(KEY) !== "1");
    } catch {
      setShow(true);
    }
  }, []);

  useEffect(() => {
    if (!show) return;

    let gone: ReturnType<typeof setTimeout>;
    const dismiss = () => {
      setLeaving(true);
      gone = setTimeout(() => {
        setShow(false);
        try {
          localStorage.setItem(KEY, "1");
        } catch {
          // private browsing · it will greet them again, which is fine
        }
      }, FADE);
    };

    const timer = setTimeout(dismiss, LINGER);
    // Working on the drawing counts as having read it. Capture, so it fires
    // whatever the press lands on, and once.
    const onStart = () => {
      clearTimeout(timer);
      dismiss();
    };
    const canvas = document.querySelector(".overhead-canvas");
    canvas?.addEventListener("pointerdown", onStart, { capture: true, once: true });
    return () => {
      clearTimeout(timer);
      clearTimeout(gone);
      canvas?.removeEventListener("pointerdown", onStart, { capture: true });
    };
  }, [show]);

  if (!show || forked || tracing) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-[58px] z-[4] flex justify-center px-4">
      <div
        className="glass pointer-events-auto flex max-w-2xl items-start gap-3 rounded-[12px] px-4 py-3"
        style={{
          transition: `opacity ${FADE}ms ease, transform ${FADE}ms ease`,
          opacity: leaving ? 0 : 1,
          transform: leaving ? "translateY(-6px)" : "none",
        }}
      >
        <div className="text-[13px] leading-relaxed text-ink-2">
          {empty ? (
            <>
              <strong className="text-ink">Empty canvas.</strong> Press A to add a
              service, open Import for a seeded template, drop a Cost Explorer CSV to
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
      </div>
    </div>
  );
}
