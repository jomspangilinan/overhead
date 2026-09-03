"use client";

// Other people, on the canvas.
//
// A room without cursors is a room you have to take on faith: things move and
// nobody is there. These are drawn inside React Flow's `ViewportPortal`, in
// canvas coordinates, so a cursor sits on the same resource on everybody's
// screen whatever their zoom or scroll · which is the entire point of sending
// canvas coordinates rather than screen ones.
//
// They never touch the drawing: a cursor lives on the peer in the room slice,
// not in the model, so it cannot be undone, exported, or saved by accident.

import { ViewportPortal } from "@xyflow/react";
import { useStore } from "@/store/useStore";
import { peerColor } from "@/net/protocol";

export function PeerCursors() {
  const room = useStore((s) => s.room);
  if (!room) return null;
  const withCursor = room.peers.filter((p) => p.cursor);
  if (!withCursor.length) return null;

  return (
    <ViewportPortal>
      {withCursor.map((p) => {
        const color = peerColor(p.id);
        return (
          <div
            key={p.id}
            className="pointer-events-none absolute"
            style={{
              transform: `translate(${p.cursor!.x}px, ${p.cursor!.y}px)`,
              // Above the frames, below nothing · a cursor is never in the way
              // because it cannot be clicked.
              zIndex: 5,
            }}
          >
            <svg width="16" height="20" viewBox="0 0 16 20" aria-hidden>
              <path
                d="M1 1 L1 15 L5 11.5 L7.5 17.5 L10 16.5 L7.5 10.8 L13 10.5 Z"
                fill={color}
                stroke="#0B0D10"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
            </svg>
            <span
              className="ml-3 inline-block rounded-[5px] px-1.5 py-[2px] text-[10px] font-medium"
              style={{
                background: color,
                color: "#0B0D10",
                fontFamily: "var(--font-mono-jb)",
                whiteSpace: "nowrap",
              }}
            >
              {p.name || p.id.slice(0, 4)}
            </span>
          </div>
        );
      })}
    </ViewportPortal>
  );
}
