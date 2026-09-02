"use client";

// The three seeded architectures, in a dialog launched from the rail.
// Loading one replaces the canvas.

import { useEffect } from "react";
import { useReactFlow } from "@xyflow/react";
import type { StateSnapshot } from "@/engine/model";
import { useStore } from "@/store/useStore";
import { getService } from "@/engine/services";

const BLURB: Record<string, string> = {
  "api-backend": "HTTP API → Lambda → DynamoDB. The smallest thing that's real.",
  "media-pipeline": "CloudFront in front of S3, SQS-fed thumbnail worker.",
  "event-driven": "Cognito, EventBridge bus, Step Functions, SNS fan-out, VPC-attached workers.",
};

export function TemplatesDialog({ samples }: { samples: Record<string, StateSnapshot> }) {
  const open = useStore((s) => s.templatesOpen);
  const setOpen = useStore((s) => s.setTemplatesOpen);
  const loadSnapshot = useStore((s) => s.loadSnapshot);
  const applyAutoLayout = useStore((s) => s.applyAutoLayout);
  const setDrawingName = useStore((s) => s.setDrawingName);
  const hasWork = useStore((s) => s.nodes.length > 0);
  const { fitView } = useReactFlow();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (!open) return null;

  const load = (name: string) => {
    loadSnapshot(samples[name]);
    applyAutoLayout();
    setDrawingName(name);
    setOpen(false);
    requestAnimationFrame(() => fitView({ maxZoom: 1, padding: 0.15, duration: 150 }));
  };

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center"
      style={{ background: "rgba(5, 7, 10, 0.55)" }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
      role="dialog"
      aria-modal
      aria-label="Templates"
    >
      <div className="glass w-[560px] max-w-[calc(100vw-40px)] rounded-2xl p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <div>
            <h2 className="text-[15px] font-semibold">Templates</h2>
            <p className="text-[11.5px]" style={{ color: "var(--ink-3)" }}>
              {hasWork ? "Loading one replaces the current canvas (undo brings it back)." : "Start from a seeded architecture."}
            </p>
          </div>
          <button className="rounded-md px-2 py-1 text-[12px] hover:bg-[var(--hover)]" style={{ color: "var(--ink-3)" }} onClick={() => setOpen(false)}>
            esc
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {Object.entries(samples).map(([name, snap]) => (
            <button
              key={name}
              className="flex flex-col rounded-xl p-3 text-left hover:bg-[var(--hover)]"
              style={{ border: "1px solid var(--line)", background: "var(--panel-2)" }}
              onClick={() => load(name)}
              title={`Load ${name}`}
            >
              <div className="flex items-center gap-1 pb-2">
                {snap.nodes.slice(0, 6).map((n) => (
                  <svg key={n.id} width="18" height="18">
                    <use href={`#${getService(n.service)?.icon ?? ""}`} width="18" height="18" />
                  </svg>
                ))}
              </div>
              <div className="text-[12.5px] font-semibold" style={{ color: "var(--ink-15)" }}>
                {name}
              </div>
              <div className="mt-1 text-[10.5px] leading-snug" style={{ color: "var(--ink-3)" }}>
                {BLURB[name]}
              </div>
              <span className="mono mt-2 text-[9.5px]" style={{ color: "var(--ink-4)" }}>
                {snap.nodes.length} resources · {snap.containers.length} containers
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
