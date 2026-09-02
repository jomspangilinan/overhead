"use client";

// 16px stroke icons for the toolbar · one drawing style, currentColor.

import type { JSX } from "react";

const PATHS: Record<string, JSX.Element> = {
  // layers
  request: <path d="M2 8h11M9.5 4l4 4-4 4" />,
  events: <path d="M9 1.5 3.5 9.5H7.5L7 14.5 12.5 6.5H8.5L9 1.5z" />,
  data: (
    <>
      <ellipse cx="8" cy="3.8" rx="5.4" ry="2" />
      <path d="M2.6 3.8v8.4c0 1.1 2.4 2 5.4 2s5.4-.9 5.4-2V3.8M2.6 8c0 1.1 2.4 2 5.4 2s5.4-.9 5.4-2" />
    </>
  ),
  security: <path d="M8 1.5 13.4 3.6v4.2c0 3.3-2.3 5.7-5.4 6.7-3.1-1-5.4-3.4-5.4-6.7V3.6L8 1.5z" />,
  cost: (
    <>
      <circle cx="8" cy="8" r="6.4" />
      <path d="M8 4.2v7.6M10.2 5.9c-.5-.7-1.3-1-2.2-1-1.1 0-2 .5-2 1.5 0 2.1 4.2 1.1 4.2 3.2 0 1-1 1.5-2.2 1.5-.9 0-1.7-.4-2.2-1.1" />
    </>
  ),
  // view
  cards: (
    <>
      <rect x="1.6" y="3.4" width="12.8" height="9.2" rx="1.6" />
      <path d="M4.4 6.4h4.4M4.4 8.9h6.4" />
    </>
  ),
  // rail glyphs · drawn on a 16 unit grid like the rest
  select: <path d="M3.5 2l4.7 11.3 1.5-4.5 4.5-1.5z" />,
  pan: (
    <path d="M6 7.3V3.7a1 1 0 0 1 2 0v3.6m0-.3V3a1 1 0 0 1 2 0v4.3m0-.3v-.7a1 1 0 0 1 2 0V10a4 4 0 0 1-4 4h-.7a4 4 0 0 1-3.4-2l-1.2-1.8a1.06 1.06 0 0 1 1.7-1.3L6 10.6" />
  ),
  plus: <path d="M8 3.2v9.6M3.2 8h9.6" />,
  minus: <path d="M3.4 8h9.2" />,
  connect: (
    <path d="M6.7 8.7a3.3 3.3 0 0 0 4.6 0l1.3-1.3a3.3 3.3 0 0 0-4.6-4.6l-.7.7M9.3 7.3a3.3 3.3 0 0 0-4.6 0L3.4 8.6a3.3 3.3 0 0 0 4.6 4.6l.7-.7" />
  ),
  container: (
    <>
      <rect x="2" y="2" width="12" height="12" rx="1.5" />
      <rect x="4.7" y="4.7" width="6.6" height="6.6" rx="1" />
    </>
  ),
  section: (
    <path
      d="M2.6 3.3h4v4h-4zM9.4 3.3h4v4h-4zM2.6 9.7h4v4h-4zM9.4 9.7h4v4h-4z"
      strokeDasharray="1.6 1.6"
    />
  ),
  trace: <path d="M4.6 2.6l8.8 5.4-8.8 5.4z" />,
  grid: <path d="M2.6 6h10.8M2.6 10h10.8M6 2.6v10.8M10 2.6v10.8" />,
  undo: (
    <>
      <path d="M5.8 4.4 3.2 7l2.6 2.6" />
      <path d="M3.2 7h6.2a3.4 3.4 0 0 1 0 6.8H8" />
    </>
  ),
  search: (
    <>
      <circle cx="7.3" cy="7.3" r="4.6" />
      <path d="M13.3 13.3l-2.6-2.6" />
    </>
  ),
  scenario: <path d="M8.6 1.6 3.4 9.4h3.8l-.5 5 5.4-8.2H8.3z" />,
  chevronLeft: <path d="M10 3.5 5.5 8l4.5 4.5" />,
  chevronRight: <path d="M6 3.5 10.5 8 6 12.5" />,
  redo: (
    <>
      <path d="M10.2 4.4 12.8 7l-2.6 2.6" />
      <path d="M12.8 7H6.6a3.4 3.4 0 0 0 0 6.8H8" />
    </>
  ),

  // zoom
  fit: <path d="M5.6 2H2v3.6M10.4 2H14v3.6M5.6 14H2v-3.6M10.4 14H14v-3.6" />,
  // actions
  export: <path d="M8 1.8v7.8M5 6.8l3 3 3-3M2.4 11.6v2.6h11.2v-2.6" />,
  samples: <path d="M8 1.8 14 4.9 8 8 2 4.9l6-3.1zM2 8l6 3.1L14 8M2 11.1l6 3.1 6-3.1" />,
  layout: (
    <>
      <rect x="1.8" y="1.8" width="5.2" height="5.2" rx="1" />
      <rect x="9" y="1.8" width="5.2" height="5.2" rx="1" />
      <rect x="1.8" y="9" width="5.2" height="5.2" rx="1" />
      <path d="M11.6 9v5.2M9 11.6h5.2" />
    </>
  ),
  info: (
    <>
      <circle cx="8" cy="8" r="6.4" />
      <path d="M8 7.2v4M8 4.6v.2" />
    </>
  ),
};

export function Icon({ name, size = 15 }: { name: keyof typeof PATHS | string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {PATHS[name] ?? null}
    </svg>
  );
}
