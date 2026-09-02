"use client";

// Lane bands drawn in graph coordinates behind the nodes.

import { ViewportPortal } from "@xyflow/react";
import { LANE_ORDER, LANE_LABELS } from "@/engine/layout";

const LANE_GAP = 260;
const X0 = 80;
const LANE_W = 220;

export function Lanes() {
  return (
    <ViewportPortal>
      {LANE_ORDER.map((lane, i) => {
        const cx = X0 + i * LANE_GAP + 100; // node hit-box is 200 wide
        return (
          <div key={lane}>
            {i % 2 === 0 ? (
              <div
                className="pointer-events-none absolute rounded-md"
                style={{
                  left: cx - LANE_W / 2,
                  top: -40,
                  width: LANE_W,
                  height: 900,
                  background: "var(--ink)",
                  opacity: 0.04,
                }}
              />
            ) : null}
            <div
              className="pointer-events-none absolute text-[10px] font-semibold tracking-[0.14em]"
              style={{
                left: cx,
                top: -24,
                transform: "translateX(-50%)",
                color: "var(--ink-3)",
                fontFamily: "var(--font-archivo)",
              }}
            >
              {LANE_LABELS[lane]}
            </div>
          </div>
        );
      })}
    </ViewportPortal>
  );
}
