"use client";

// The room, in the top bar.
//
// Off by default and honest about it: before you press it there is no socket
// and no server in this app at all. Pressing it makes a room id, puts it in
// the URL and copies the link · the invite is the address bar, the way it is
// in every tool people already use for this.
//
// Live, it says how many are here and lets you copy the link again or leave.
// "Reconnecting" is a state worth showing rather than hiding: a function has
// a maximum duration, so a long session will drop and come back, and a
// silent gap would read as the other person having gone.

import { useEffect, useState } from "react";
import { useStore } from "@/store/useStore";
import { joinRoom, leaveRoom, roomLink } from "@/net/room";
import { Icon } from "../Icon";

export function LivePill() {
  const room = useStore((s) => s.room);
  const notify = useStore((s) => s.notify);
  const [copied, setCopied] = useState(false);

  // A link with `?room=` in it is an invitation · take it on load.
  useEffect(() => {
    const id = new URL(window.location.href).searchParams.get("room");
    if (id && !useStore.getState().room) joinRoom(id);
  }, []);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    const link = roomLink();
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      notify("Could not copy · the link is in the address bar", "warn");
    }
  };

  if (!room) {
    return (
      <button
        className="flex items-center gap-[7px] rounded-lg px-3 py-[7px] text-[12px] font-medium hover:bg-[var(--hover)]"
        style={{ border: "1px solid var(--line-2)", background: "var(--panel)", color: "var(--ink-15)" }}
        data-tip="Work on this drawing with other people and their agents · the link is the invite"
        aria-label="Go live"
        onClick={() => {
          joinRoom();
          void copy();
          notify("Room started · the link is copied, send it to anyone");
        }}
      >
        <Icon name="scenario" size={14} />
        Live
      </button>
    );
  }

  const here = room.peers.length + 1;
  const tone =
    room.status === "live" ? "var(--good)" : room.status === "connecting" ? "var(--warn)" : "var(--bad)";

  return (
    <div
      className="flex items-center gap-2 rounded-lg py-[6px] pl-[10px] pr-[6px] text-[12px]"
      style={{ border: "1px solid var(--line-2)", background: "var(--panel)" }}
    >
      <span
        className="h-[7px] w-[7px] flex-none rounded-full"
        style={{ background: tone, boxShadow: room.status === "live" ? `0 0 0 3px color-mix(in srgb, ${tone} 22%, transparent)` : undefined }}
      />
      <span style={{ color: "var(--ink-15)", fontFamily: "var(--font-mono-jb)" }}>
        {room.status === "reconnecting" ? "reconnecting" : `${here} here`}
      </span>
      {room.host && here > 1 ? (
        <span className="text-[10px]" style={{ color: "var(--ink-4)", fontFamily: "var(--font-mono-jb)" }}>
          hosting
        </span>
      ) : null}
      <button
        className="rounded-md px-1.5 py-0.5 text-[11px] hover:bg-[var(--hover)]"
        style={{ color: "var(--ink-2)" }}
        data-tip="Copy the invite link"
        aria-label="Copy the room link"
        onClick={() => void copy()}
      >
        {copied ? "copied" : "link"}
      </button>
      <button
        className="rounded-md px-1.5 py-0.5 text-[11px] hover:bg-[var(--hover)]"
        style={{ color: "var(--ink-3)" }}
        data-tip={
          room.host
            ? "Leave · you started this room, so it closes for everyone. The drawing stays with you."
            : "Leave the room · the drawing stays with you"
        }
        aria-label="Leave the room"
        onClick={() => {
          const wasHost = room.host && room.peers.length;
          leaveRoom();
          notify(
            wasHost
              ? "Left · the room is closed for everyone. This drawing is yours."
              : "Left the room · this drawing is yours now",
          );
        }}
      >
        leave
      </button>
    </div>
  );
}
