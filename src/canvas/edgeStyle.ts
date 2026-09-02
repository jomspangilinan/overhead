// Edge drawing helpers shared by the canvas and the styling tools. Pure TS.

import type { EdgeDash } from "@/engine/model";

/** Stroke width follows volume on a log scale, 1.2 → 3.5 px. */
export function widthFor(volume?: number): number {
  if (!volume || volume <= 0) return 1.4;
  const t = Math.min(1, Math.max(0, (Math.log10(volume) - 3) / 5));
  return 1.2 + t * 2.3;
}

export const DASH: Record<EdgeDash, string | undefined> = {
  solid: undefined,
  dashed: "7 5",
  dotted: "2 5",
};

export function volumeLabel(volume?: number): string | null {
  if (!volume) return null;
  if (volume >= 1_000_000) return `${+(volume / 1_000_000).toFixed(1)}M/mo`;
  if (volume >= 1_000) return `${+(volume / 1_000).toFixed(0)}k/mo`;
  return `${volume}/mo`;
}
