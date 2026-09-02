"use client";

// Injects the official AWS icon sprite inline once, so <use href="#aws-…">
// resolves everywhere. External sprite refs are flaky across browsers;
// inline is the vector-always path.

import { useEffect, useState } from "react";

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

  if (!markup) return null;
  return (
    <div
      aria-hidden
      data-oh-sprite
      style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
