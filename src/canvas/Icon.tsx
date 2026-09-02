"use client";

// 16px stroke icons for the toolbar — one drawing style, currentColor.

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
  lanes: (
    <>
      <rect x="1.6" y="2" width="3.5" height="12" rx="1" />
      <rect x="6.25" y="2" width="3.5" height="12" rx="1" />
      <rect x="10.9" y="2" width="3.5" height="12" rx="1" />
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
