"use client";

// Fitting the drawing, not the nodes.
//
// React Flow's `fitView` fits what React Flow knows about, and it does not
// know about frames: containers and sections are painted through a
// ViewportPortal, so a drawing whose VPC extends below its lowest resource
// fits to the resource and clips the VPC. That is why importing a sample
// left the AWS Cloud's header off the top of the screen at 100%.
//
// The rectangle to fit is the same union the picture exporters already use
// (`exportImage.ts`): node bounds ∪ every stored frame rectangle. One
// implementation, three callers · the first fit after a seed, the Import
// dialog, and the zoom pill's Fit button.

import { useCallback } from "react";
import { getNodesBounds, getViewportForBounds, useReactFlow, useStore as useFlowStore } from "@xyflow/react";
import { useStore } from "@/store/useStore";

const PAD = 40;

export function useFitDrawing() {
  const { getNodes, setViewport, fitView } = useReactFlow();
  const width = useFlowStore((s) => s.width);
  const height = useFlowStore((s) => s.height);

  return useCallback(
    (opts: { duration?: number; maxZoom?: number } = {}) => {
      const nodes = getNodes();
      const { containers, sections } = useStore.getState();
      const frames = [
        ...containers.flatMap((c) => (c.bounds ? [c.bounds] : [])),
        ...sections.flatMap((x) => (x.bounds ? [x.bounds] : [])),
      ];
      if (!nodes.length || !width || !height) return false;
      const nb = getNodesBounds(nodes);
      let l = nb.x;
      let t = nb.y;
      let r = nb.x + nb.width;
      let b = nb.y + nb.height;
      for (const f of frames) {
        l = Math.min(l, f.x);
        t = Math.min(t, f.y);
        r = Math.max(r, f.x + f.w);
        b = Math.max(b, f.y + f.h);
      }
      // No frame reaches past the resources · React Flow's own fit is right,
      // and it already handles the empty and single-node cases.
      if (!frames.length) {
        void fitView({ maxZoom: opts.maxZoom ?? 1, padding: 0.15, duration: opts.duration });
        return true;
      }
      const bounds = { x: l - PAD, y: t - PAD, width: r - l + PAD * 2, height: b - t + PAD * 2 };
      const vp = getViewportForBounds(bounds, width, height, 0.1, opts.maxZoom ?? 1, 0);
      void setViewport(vp, { duration: opts.duration });
      return true;
    },
    [getNodes, setViewport, fitView, width, height],
  );
}
