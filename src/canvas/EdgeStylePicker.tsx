"use client";

// The edge styling tools: line style, arrowheads, shape, weight. Visual
// only · nothing here reads or writes the edge's `kind`. Used twice: as the
// floating toolbar beside a selected edge (compact) and in the Inspector's
// Styling section (full, with labels).

import type { ArchEdge, ArrowMode, EdgeDash, EdgeShape } from "@/engine/model";
import { dashOf, arrowModeOf, dashForKind } from "@/engine/model";
import { useStore } from "@/store/useStore";
import { widthFor } from "./edgeStyle";

const DASH_ATTR: Record<EdgeDash, string | undefined> = { solid: undefined, dashed: "6 4", dotted: "1.5 4" };

function Seg({
  on,
  tip,
  onClick,
  children,
  tipPos = "top",
}: {
  on: boolean;
  tip: string;
  onClick: () => void;
  children: React.ReactNode;
  tipPos?: "top" | "bottom";
}) {
  return (
    <button
      data-tip={tip}
      data-tip-pos={tipPos}
      aria-label={tip}
      aria-pressed={on}
      onClick={onClick}
      className="grid h-[26px] w-[30px] place-items-center rounded-md hover:bg-[var(--hover-2)]"
      style={{ background: on ? "var(--accent-bg)" : undefined, color: on ? "var(--accent-ink)" : "var(--ink-2)" }}
    >
      {children}
    </button>
  );
}

const Group = ({ children, label }: { children: React.ReactNode; label?: string }) => (
  <div className="flex items-center gap-[1px]" role="group" aria-label={label}>
    {children}
  </div>
);

const Divider = () => <span className="mx-1 h-4 w-px self-center" style={{ background: "var(--line-2)" }} />;

function LinePreview({ dash, width = 1.6 }: { dash: EdgeDash; width?: number }) {
  return (
    <svg width="22" height="8" viewBox="0 0 22 8" fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round">
      <path d="M1 4h20" strokeDasharray={DASH_ATTR[dash]} />
    </svg>
  );
}

function ArrowGlyph({ mode }: { mode: ArrowMode }) {
  const head = (x: number, dir: 1 | -1) => <path d={`M${x - dir * 4} 1 ${x} 4 ${x - dir * 4} 7`} />;
  return (
    <svg width="22" height="8" viewBox="0 0 22 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4h18" />
      {mode === "end" || mode === "both" ? head(20, 1) : null}
      {mode === "start" || mode === "both" ? head(2, -1) : null}
    </svg>
  );
}

function ShapeGlyph({ shape }: { shape: EdgeShape }) {
  const d = shape === "curve" ? "M2 7 C 8 7 8 1 14 1 L 20 1" : shape === "straight" ? "M2 7 L 20 1" : "M2 7 H 11 V 1 H 20";
  return (
    <svg width="22" height="8" viewBox="0 0 22 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

export function EdgeStylePicker({ edge, compact, tipPos = "top" }: { edge: ArchEdge; compact?: boolean; tipPos?: "top" | "bottom" }) {
  const setEdgeStyle = useStore((s) => s.setEdgeStyle);
  const style = edge.style ?? {};
  const dash = dashOf(edge);
  const arrow = arrowModeOf(edge);
  const shape = style.shape ?? "curve";
  const auto = style.width === undefined;
  const width = style.width ?? widthFor(edge.volumePerMonth);
  const step = (delta: number) => setEdgeStyle(edge.id, { width: Math.max(1, Math.min(6, Math.round((width + delta) * 2) / 2)) });

  const groups = (
    <>
      <Group label="Line style">
        {(["solid", "dashed", "dotted"] as EdgeDash[]).map((d) => (
          <Seg key={d} on={dash === d} tipPos={tipPos} tip={`${d}${d === dashForKind(edge.kind) ? " · default for this kind" : ""}`} onClick={() => setEdgeStyle(edge.id, { dash: d === dashForKind(edge.kind) ? undefined : d })}>
            <LinePreview dash={d} />
          </Seg>
        ))}
      </Group>
      <Divider />
      <Group label="Arrowheads">
        {(["none", "end", "start", "both"] as ArrowMode[]).map((m) => (
          <Seg key={m} on={arrow === m} tipPos={tipPos} tip={m === "none" ? "No arrowhead" : m === "end" ? "Arrow at the end" : m === "start" ? "Arrow at the start" : "Arrows both ways"} onClick={() => setEdgeStyle(edge.id, { arrow: m })}>
            <ArrowGlyph mode={m} />
          </Seg>
        ))}
      </Group>
      <Divider />
      <Group label="Shape">
        {(["curve", "straight", "step"] as EdgeShape[]).map((sh) => (
          <Seg key={sh} on={shape === sh} tipPos={tipPos} tip={sh === "curve" ? "Curved" : sh === "straight" ? "Straight lines" : "Right-angle steps"} onClick={() => setEdgeStyle(edge.id, { shape: sh === "curve" ? undefined : sh })}>
            <ShapeGlyph shape={sh} />
          </Seg>
        ))}
      </Group>
      <Divider />
      <Group label="Weight">
        <Seg on={false} tipPos={tipPos} tip="Thinner" onClick={() => step(-0.5)}>
          <span className="text-[12px] leading-none">−</span>
        </Seg>
        <button
          data-tip={auto ? "Weight follows volume · click to pin" : "Pinned · click for auto"}
          data-tip-pos={tipPos}
          className="mono h-[26px] min-w-[34px] rounded-md px-1 text-[10.5px] hover:bg-[var(--hover-2)]"
          style={{ color: auto ? "var(--ink-3)" : "var(--accent-ink)" }}
          onClick={() => setEdgeStyle(edge.id, { width: auto ? width : undefined })}
        >
          {width.toFixed(1)}
        </button>
        <Seg on={false} tipPos={tipPos} tip="Thicker" onClick={() => step(0.5)}>
          <span className="text-[12px] leading-none">+</span>
        </Seg>
      </Group>
    </>
  );

  if (compact) return <div className="flex items-center">{groups}</div>;
  return <div className="flex flex-wrap items-center gap-y-1.5">{groups}</div>;
}
