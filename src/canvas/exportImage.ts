"use client";

// Picture exports: PNG, SVG and PDF of the whole drawing.
//
// Two things they all share. First, they render the *drawing*, not the
// screen: the old capture handed html-to-image the live viewport element,
// so whatever was panned off-screen was simply missing and the zoom you
// happened to be at decided the resolution. Here the union of every node
// and every frame becomes the frame of the picture, and the viewport is
// given a transform that fits it exactly for the duration of the capture.
// Second, the PDF is a real one-page PDF built here (a JPEG wrapped in the
// smallest legal document) rather than a print dialog · no backend, no
// dependency.

import { toPng, toSvg, toJpeg } from "html-to-image";
import { getNodesBounds, getViewportForBounds, type Node } from "@xyflow/react";

/** Space around the drawing, in flow units, so frame labels never touch the edge. */
const MARGIN = 64;
/** Nothing sensible comes out of a capture wider than this. */
const MAX_PX = 6000;

export interface CaptureOpts {
  /** Extra rectangles to include · frames the user resized past their contents. */
  frames?: { x: number; y: number; w: number; h: number }[];
  /** Page background · null leaves it transparent (PNG and SVG only). */
  background: string | null;
  /** Device pixels per CSS pixel (PNG and PDF). */
  scale?: number;
}

interface Fit {
  el: HTMLElement;
  width: number;
  height: number;
  style: Record<string, string>;
}

/** The viewport element plus the transform that fits the whole drawing into
 *  a `width` × `height` picture. */
function fitDrawing(nodes: Node[], opts: CaptureOpts): Fit | null {
  const el = document.querySelector<HTMLElement>(".react-flow__viewport");
  if (!el || !nodes.length) return null;
  const nb = getNodesBounds(nodes);
  let l = nb.x - MARGIN;
  let t = nb.y - MARGIN;
  let r = nb.x + nb.width + MARGIN;
  let b = nb.y + nb.height + MARGIN;
  for (const f of opts.frames ?? []) {
    l = Math.min(l, f.x - MARGIN);
    t = Math.min(t, f.y - MARGIN);
    r = Math.max(r, f.x + f.w + MARGIN);
    b = Math.max(b, f.y + f.h + MARGIN);
  }
  const bounds = { x: l, y: t, width: r - l, height: b - t };
  const shrink = Math.min(1, MAX_PX / Math.max(bounds.width, bounds.height));
  const width = Math.ceil(bounds.width * shrink);
  const height = Math.ceil(bounds.height * shrink);
  const vp = getViewportForBounds(bounds, width, height, 0.05, 4, 0);
  return {
    el,
    width,
    height,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})`,
    },
  };
}

export interface Capture {
  dataUrl: string;
  width: number;
  height: number;
}

export async function captureDrawing(
  kind: "png" | "svg" | "jpeg",
  nodes: Node[],
  opts: CaptureOpts,
): Promise<Capture | null> {
  const fit = fitDrawing(nodes, opts);
  if (!fit) return null;
  const scale = opts.scale ?? 2;
  // Every service icon is a <use href="#aws-…"> into the sprite, and the
  // sprite is injected at the app root · outside the element being
  // captured. html-to-image serialises only that element into an isolated
  // document, where those ids resolve to nothing, which is why exported
  // pictures came out with the icons missing and only the labels left. The
  // picture has to carry the symbols it references, so the sprite rides
  // along inside the captured subtree for the length of the capture.
  const sprite = document.querySelector<HTMLElement>("[data-oh-sprite]");
  const carried = sprite?.cloneNode(true) as HTMLElement | undefined;
  if (carried) {
    carried.removeAttribute("data-oh-sprite");
    fit.el.appendChild(carried);
  }
  const common = {
    width: fit.width,
    height: fit.height,
    style: fit.style,
    backgroundColor: opts.background ?? undefined,
    // the frame controls only exist while a frame is hovered, but a hover
    // can survive the click that opened the dialog
    filter: (n: HTMLElement) => !n.classList?.contains?.("oh-frame-cluster"),
  };
  try {
    const dataUrl =
      kind === "svg"
        ? await toSvg(fit.el, common)
        : kind === "png"
          ? await toPng(fit.el, { ...common, pixelRatio: scale })
          : await toJpeg(fit.el, { ...common, pixelRatio: scale, quality: 0.94, backgroundColor: opts.background ?? "#0B0D10" });
    return { dataUrl, width: fit.width * scale, height: fit.height * scale };
  } finally {
    carried?.remove();
  }
}

function bytesOf(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const latin1 = (s: string): Uint8Array => {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
};

/**
 * One JPEG, one page, the smallest PDF that is still a valid PDF: catalog,
 * page tree, page, the image as a DCTDecode XObject, and a content stream
 * that paints it over the whole page. Offsets are counted as we append,
 * because the xref table has to name the byte each object starts at.
 */
export function jpegToPdf(jpeg: Uint8Array, pxW: number, pxH: number, scale: number, title: string): Blob {
  const w = Math.round(pxW / scale);
  const h = Math.round(pxH / scale);
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let at = 0;
  const push = (chunk: Uint8Array | string) => {
    const bytes = typeof chunk === "string" ? latin1(chunk) : chunk;
    parts.push(bytes);
    at += bytes.length;
  };
  const obj = (n: number, body: string, stream?: Uint8Array) => {
    offsets[n] = at;
    push(`${n} 0 obj\n${body}\n`);
    if (stream) {
      push("stream\n");
      push(stream);
      push("\nendstream\n");
    }
    push("endobj\n");
  };

  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  obj(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
  );
  obj(
    4,
    `<< /Type /XObject /Subtype /Image /Width ${pxW} /Height ${pxH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>`,
    jpeg,
  );
  const content = latin1(`q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`);
  obj(5, `<< /Length ${content.length} >>`, content);
  const safe = title.replace(/[()\\]/g, "");
  obj(6, `<< /Title (${safe}) /Producer (Overhead) >>`);

  const xrefAt = at;
  let xref = "xref\n0 7\n0000000000 65535 f \n";
  for (let n = 1; n <= 6; n++) xref += `${String(offsets[n]).padStart(10, "0")} 00000 n \n`;
  push(xref);
  push(`trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`);

  const total = parts.reduce((n, p) => n + p.length, 0);
  const pdf = new Uint8Array(total);
  let cursor = 0;
  for (const p of parts) {
    pdf.set(p, cursor);
    cursor += p.length;
  }
  return new Blob([pdf], { type: "application/pdf" });
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}

export { bytesOf };
