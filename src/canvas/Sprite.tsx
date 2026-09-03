"use client";

// Injects the official AWS icon sprite inline once, so <use href="#aws-…">
// resolves everywhere. External sprite refs are flaky across browsers;
// inline is the vector-always path.

import { useEffect, useState } from "react";
import { flowSprite } from "@/engine/services/flowShapes";

// The flow vocabulary's shapes are drawn once, in
// `engine/services/flowShapes.ts` · the canvas injects them as symbols here
// and the Mermaid export inlines the same six as data URIs. Two uses, one
// drawing. They stay out of public/icons/aws/sprite.svg because NOTICE.md
// carves that file out of the MIT licence and mixing ours in would blur it.
const FLOW_SPRITE = flowSprite();

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
