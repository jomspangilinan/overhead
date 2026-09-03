// The flow vocabulary's artwork · ours, MIT, one drawing per shape.
//
// It is defined here rather than in the sprite component because it is used
// three ways and all three have to be the same picture:
//
//  1. `canvas/Sprite.tsx` builds the inline `<symbol>` set from it, so the
//     canvas can draw `<use href="#flow-decision">`.
//  2. `public/icons/flow/<id>.svg` holds each one as a file, written from
//     here by `npm run flow-icons` and asserted by `tests/flow-icons.test.ts`
//     so the file and the canvas can never disagree. The Mermaid export
//     links to those, exactly as it links to the AWS ones · a flow shape
//     arrives in somebody else's renderer looking like it does here, and an
//     exported document reads as one thing rather than two.
//
// Drawn on the AWS sprite's 80-unit grid, so `<use width={ICON}>` sizes them
// identically. Colours are literal rather than `currentColor` or a token:
// the picture exporters serialise into an isolated document where neither
// resolves, and a file linked from a Mermaid document has no page at all.

const STROKE = "#9AA6B7";
const FILL = "#1B2330";

/** Shape id (without the `flow-` prefix) → the body of its 80×80 drawing. */
export const FLOW_SHAPES: Record<string, string> = {
  step: `<rect x="9" y="19" width="62" height="42" rx="7" fill="${FILL}" stroke="${STROKE}" stroke-width="3"/>
<path d="M22 34h36M22 46h24" stroke="${STROKE}" stroke-width="3" stroke-linecap="round"/>`,
  decision: `<path d="M40 10 70 40 40 70 10 40z" fill="${FILL}" stroke="${STROKE}" stroke-width="3" stroke-linejoin="round"/>
<path d="M31 40h18M40 31v18" stroke="${STROKE}" stroke-width="3" stroke-linecap="round"/>`,
  terminal: `<rect x="7" y="23" width="66" height="34" rx="17" fill="${FILL}" stroke="${STROKE}" stroke-width="3"/>
<circle cx="40" cy="40" r="6" fill="${STROKE}"/>`,
  actor: `<circle cx="40" cy="40" r="30" fill="${FILL}" stroke="${STROKE}" stroke-width="3"/>
<circle cx="40" cy="32" r="8" fill="none" stroke="${STROKE}" stroke-width="3"/>
<path d="M25 58a15 15 0 0 1 30 0" fill="none" stroke="${STROKE}" stroke-width="3" stroke-linecap="round"/>`,
  store: `<path d="M14 24v32c0 4.4 11.6 8 26 8s26-3.6 26-8V24" fill="${FILL}" stroke="${STROKE}" stroke-width="3"/>
<ellipse cx="40" cy="24" rx="26" ry="8" fill="${FILL}" stroke="${STROKE}" stroke-width="3"/>
<path d="M14 40c0 4.4 11.6 8 26 8s26-3.6 26-8" fill="none" stroke="${STROKE}" stroke-width="3"/>`,
  external: `<rect x="9" y="19" width="62" height="42" rx="7" fill="${FILL}" stroke="${STROKE}" stroke-width="3"/>
<path d="M21 19v42M59 19v42" stroke="${STROKE}" stroke-width="3"/>
<path d="M34 46l12-12M38 34h8v8" stroke="${STROKE}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,
};

/** The inline sprite the canvas injects · one `<symbol>` per shape. */
export function flowSprite(): string {
  const symbols = Object.entries(FLOW_SHAPES)
    .map(([id, body]) => `  <symbol id="flow-${id}" viewBox="0 0 80 80">\n${body}\n  </symbol>`)
    .join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" style="display:none">\n${symbols}\n</svg>`;
}

/** One shape as a standalone SVG document. */
export function flowIconFile(id: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="80" height="80">${FLOW_SHAPES[id]}</svg>`;
}
