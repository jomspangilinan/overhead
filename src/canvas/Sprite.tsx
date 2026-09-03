"use client";

// Injects the official AWS icon sprite inline once, so <use href="#aws-…">
// resolves everywhere. External sprite refs are flaky across browsers;
// inline is the vector-always path.

import { useEffect, useState } from "react";

// The flow vocabulary's shapes (services/flow.ts) · ours, MIT, and drawn on
// the AWS sprite's 80-unit grid so <use width={ICON}> sizes them identically.
// They live in the same [data-oh-sprite] element rather than in the AWS file:
// public/icons/aws/NOTICE.md carves the official icons out of the licence,
// and mixing our own shapes into that file would blur the line. Colours are
// literal rather than `currentColor` or a token, because the picture
// exporters serialise the captured subtree into an isolated document where
// neither resolves (`canvas/exportImage.ts`).
const STROKE = "#9AA6B7";
const FILL = "#1B2330";
const FLOW_SPRITE = `
<svg xmlns="http://www.w3.org/2000/svg" style="display:none">
  <symbol id="flow-step" viewBox="0 0 80 80">
    <rect x="9" y="19" width="62" height="42" rx="7" fill="${FILL}" stroke="${STROKE}" stroke-width="3"/>
    <path d="M22 34h36M22 46h24" stroke="${STROKE}" stroke-width="3" stroke-linecap="round"/>
  </symbol>
  <symbol id="flow-decision" viewBox="0 0 80 80">
    <path d="M40 10 70 40 40 70 10 40z" fill="${FILL}" stroke="${STROKE}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M31 40h18M40 31v18" stroke="${STROKE}" stroke-width="3" stroke-linecap="round"/>
  </symbol>
  <symbol id="flow-terminal" viewBox="0 0 80 80">
    <rect x="7" y="23" width="66" height="34" rx="17" fill="${FILL}" stroke="${STROKE}" stroke-width="3"/>
    <circle cx="40" cy="40" r="6" fill="${STROKE}"/>
  </symbol>
  <symbol id="flow-actor" viewBox="0 0 80 80">
    <circle cx="40" cy="40" r="30" fill="${FILL}" stroke="${STROKE}" stroke-width="3"/>
    <circle cx="40" cy="32" r="8" fill="none" stroke="${STROKE}" stroke-width="3"/>
    <path d="M25 58a15 15 0 0 1 30 0" fill="none" stroke="${STROKE}" stroke-width="3" stroke-linecap="round"/>
  </symbol>
  <symbol id="flow-store" viewBox="0 0 80 80">
    <path d="M14 24v32c0 4.4 11.6 8 26 8s26-3.6 26-8V24" fill="${FILL}" stroke="${STROKE}" stroke-width="3"/>
    <ellipse cx="40" cy="24" rx="26" ry="8" fill="${FILL}" stroke="${STROKE}" stroke-width="3"/>
    <path d="M14 40c0 4.4 11.6 8 26 8s26-3.6 26-8" fill="none" stroke="${STROKE}" stroke-width="3"/>
  </symbol>
  <symbol id="flow-external" viewBox="0 0 80 80">
    <rect x="9" y="19" width="62" height="42" rx="7" fill="${FILL}" stroke="${STROKE}" stroke-width="3"/>
    <path d="M21 19v42M59 19v42" stroke="${STROKE}" stroke-width="3"/>
    <path d="M34 46l12-12M38 34h8v8" stroke="${STROKE}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  </symbol>
</svg>`;

export function Sprite() {
  const [markup, setMarkup] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/icons/aws/sprite.svg")
      .then((r) => r.text())
      .then((text) => {
        if (!cancelled) setMarkup(text);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // The flow shapes do not wait on a fetch · they are in the bundle.
  return (
    <div
      aria-hidden
      data-oh-sprite
      style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
      dangerouslySetInnerHTML={{ __html: FLOW_SPRITE + (markup ?? "") }}
    />
  );
}
