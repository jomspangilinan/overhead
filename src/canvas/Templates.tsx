"use client";

// The three seeded architectures. Loading one replaces the canvas.

import { useReactFlow } from "@xyflow/react";
import type { StateSnapshot } from "@/engine/model";
import { useStore } from "@/store/useStore";
import { getService } from "@/engine/services";

const BLURB: Record<string, string> = {
  "api-backend": "HTTP API → Lambda → DynamoDB. The smallest thing that's real.",
  "media-pipeline": "CloudFront in front of S3, SQS-fed thumbnail worker.",
  "event-driven": "Cognito, EventBridge bus, Step Functions, SNS fan-out, VPC-attached workers.",
};

export function Templates({ samples }: { samples: Record<string, StateSnapshot> }) {
  const loadSnapshot = useStore((s) => s.loadSnapshot);
  const applyAutoLayout = useStore((s) => s.applyAutoLayout);
  const setDrawingName = useStore((s) => s.setDrawingName);
  const { fitView } = useReactFlow();

  const load = (name: string) => {
    loadSnapshot(samples[name]);
    applyAutoLayout();
    setDrawingName(name);
    requestAnimationFrame(() => fitView({ maxZoom: 1, padding: 0.15, duration: 150 }));
  };

  return (
    <div className="flex flex-col gap-1.5 p-2">
      {Object.entries(samples).map(([name, snap]) => (
        <button
          key={name}
          className="rounded-lg p-2.5 text-left hover:bg-[var(--hover)]"
          style={{ border: "1px solid var(--line)" }}
          onClick={() => load(name)}
          title={`Load ${name} — replaces the canvas`}
        >
          <div className="flex items-center gap-1 pb-1">
            {snap.nodes.slice(0, 6).map((n) => (
              <svg key={n.id} width="16" height="16">
                <use href={`#${getService(n.service)?.icon ?? ""}`} width="16" height="16" />
              </svg>
            ))}
            <span className="ml-auto text-[9.5px]" style={{ fontFamily: "var(--font-mono-jb)", color: "var(--ink-4)" }}>
              {snap.nodes.length} · {snap.containers.length}c
            </span>
          </div>
          <div className="text-[12px] font-medium" style={{ color: "var(--ink-15)" }}>
            {name}
          </div>
          <div className="text-[10.5px] leading-snug" style={{ color: "var(--ink-3)" }}>
            {BLURB[name]}
          </div>
        </button>
      ))}
    </div>
  );
}
