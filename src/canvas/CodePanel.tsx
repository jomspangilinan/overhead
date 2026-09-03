"use client";

// The drawing as a document you can type into.
//
// Same object as the canvas, same object the agent patches (`engine/patch.ts`)
// · this panel is the third view of it, and the point of it is that the
// canvas is not the only way to draw. Paste a node in and it appears; change
// `memoryMb` and the total moves.
//
// Live, not Apply: every keystroke that leaves valid JSON redraws, debounced.
// Invalid JSON is not an error state to recover from, it is just a document
// halfway through being typed, so the canvas holds the last good version and
// the footer says what is wrong with this one.
//
// Two rules keep a live editor from fighting its user:
//
//   While you are typing, nothing writes over you. The text is local state;
//   the store only re-seeds it when the panel is not dirty (which is why
//   dragging a node updates the JSON, but only when you are not mid-edit).
//   A write of our own is remembered (`ours`) so the round trip does not
//   come back and reformat what you are typing.
//
//   Selecting on the canvas scrolls the document to that object, because a
//   panel showing 400 lines of JSON that ignores what you clicked is a wall.

import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/store/useStore";
import { applyPatch } from "@/engine/patch";
import { DEFAULT_TRAFFIC, type StateSnapshot } from "@/engine/model";
import { onBackspace, onEnter, onTab, type TextEdit } from "./textIndent";
import { lineOf, objectAt, objectRanges } from "./codeRanges";

const DEBOUNCE = 300;
/** One line, everywhere · the gutter, the bands and the textarea share it. */
const LINE_H = 16;
const PAD_Y = 10;

/** The base a typed document is validated against · everything in it is new. */
const EMPTY: StateSnapshot = { nodes: [], edges: [], containers: [], sections: [], traffic: DEFAULT_TRAFFIC };

/** The document · the snapshot, formatted the way the JSON export is. */
function documentOf(snap: StateSnapshot): string {
  return JSON.stringify(snap, null, 2);
}

/** "Unexpected token } in JSON at position 412" → the line it is on. */
function lineOfError(text: string, err: unknown): { line: number; message: string } {
  const message = err instanceof Error ? err.message : String(err);
  const at = /position (\d+)/.exec(message);
  const line = at ? text.slice(0, Number(at[1])).split("\n").length : 0;
  return { line, message: message.replace(/^JSON\.parse: /, "").replace(/ in JSON at position \d+/, "") };
}

export function CodePanel() {
  const nodes = useStore((s) => s.nodes);
  const edges = useStore((s) => s.edges);
  const containers = useStore((s) => s.containers);
  const sections = useStore((s) => s.sections);
  const traffic = useStore((s) => s.traffic);
  const selectedId = useStore((s) => s.selectedId);
  const selectedEdgeId = useStore((s) => s.selectedEdgeId);
  const loadSnapshot = useStore((s) => s.loadSnapshot);

  const snap = useMemo<StateSnapshot>(
    () => ({ nodes, edges, containers, sections, traffic }),
    [nodes, edges, containers, sections, traffic],
  );
  const live = useMemo(() => documentOf(snap), [snap]);

  const box = useRef<HTMLTextAreaElement>(null);
  const caret = useRef<[number, number] | null>(null);
  /** The last text we applied · a store change that matches it is our own. */
  const ours = useRef<string | null>(null);
  const [draft, setDraft] = useState(live);
  const [status, setStatus] = useState<{ tone: "ok" | "bad" | "idle"; text: string }>({
    tone: "idle",
    text: "in sync with the canvas",
  });

  const dirty = draft !== live && ours.current !== draft;

  // The canvas changed under us · adopt it, unless the user is mid-edit.
  useEffect(() => {
    if (ours.current === draft) {
      // Our own write came back · take the canvas's formatting from here.
      ours.current = null;
      setDraft(live);
      setStatus({ tone: "ok", text: "applied" });
      return;
    }
    if (draft === live || !box.current || document.activeElement === box.current) return;
    setDraft(live);
    setStatus({ tone: "idle", text: "in sync with the canvas" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);

  // Typing · parse, and on valid JSON redraw.
  useEffect(() => {
    if (draft === live || ours.current === draft) return;
    const t = setTimeout(() => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(draft);
      } catch (err) {
        const { line, message } = lineOfError(draft, err);
        setStatus({ tone: "bad", text: line ? `line ${line}: ${message}` : message });
        return;
      }
      if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as StateSnapshot).nodes)) {
        setStatus({ tone: "bad", text: "a drawing needs a nodes array" });
        return;
      }
      // The document goes through the same door the agent's patch does:
      // applied to an empty drawing, every object is validated (a service
      // that does not exist, a setting out of range, a frame inside itself)
      // and what comes back is already migrated. One writer, one validator,
      // whoever is typing.
      const doc = parsed as Record<string, unknown>;
      const built = applyPatch(EMPTY, {
        nodes: doc.nodes as Record<string, unknown>[],
        containers: doc.containers as Record<string, unknown>[],
        sections: doc.sections as Record<string, unknown>[],
        edges: doc.edges as Record<string, unknown>[],
        traffic: doc.traffic as StateSnapshot["traffic"],
      });
      if (!built.ok) {
        setStatus({ tone: "bad", text: `${built.at ? `${built.at} · ` : ""}${built.message}` });
        return;
      }
      ours.current = draft;
      loadSnapshot(built.snapshot);
      setStatus({ tone: "ok", text: "applied" });
    }, DEBOUNCE);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  // Caret restore after an indent edit.
  useEffect(() => {
    if (!caret.current || !box.current) return;
    box.current.setSelectionRange(caret.current[0], caret.current[1]);
    caret.current = null;
  }, [draft]);

  // Where the caret is · which line, and which object holds it. Recomputed
  // from the text, never from a parse: the caret moves most while the
  // document is mid-edit, which is exactly when a parse is unavailable.
  const ranges = useMemo(() => objectRanges(draft), [draft]);
  const [caretAt, setCaretAt] = useState(0);
  const here = useMemo(() => objectAt(ranges, caretAt), [ranges, caretAt]);
  const caretLine = useMemo(() => lineOf(draft, caretAt), [draft, caretAt]);
  const band = useMemo(
    () => (here ? { from: lineOf(draft, here.start), to: lineOf(draft, here.end) } : null),
    [draft, here],
  );
  const lineCount = useMemo(() => draft.split("\n").length, [draft]);
  const [scroll, setScroll] = useState(0);

  const readCaret = (el: HTMLTextAreaElement) => setCaretAt(el.selectionStart);

  /** Everything in the document is selectable, and a connection is a first
   *  class object here as much as a resource is · it has an id, a band and a
   *  place in the Inspector. The store keeps the two selections apart
   *  (`select` vs `selectEdge`, mutually exclusive), so this picks the right
   *  one rather than only knowing about resources. */
  const selectionFor = (id: string): "object" | "edge" | null => {
    if (nodes.some((n) => n.id === id) || containers.some((c) => c.id === id) || sections.some((x) => x.id === id))
      return "object";
    return edges.some((e) => e.id === id) ? "edge" : null;
  };

  /** The other half of the loop: the object under the caret is the selection
   *  on the canvas. `fromCaret` marks it as ours so the scroll-to-selection
   *  below does not then yank the document out from under the typing. */
  const fromCaret = useRef<string | null>(null);
  useEffect(() => {
    if (!here || here.id === selectedId || here.id === selectedEdgeId) return;
    const kind = selectionFor(here.id);
    if (!kind) return;
    fromCaret.current = here.id;
    if (kind === "edge") useStore.getState().selectEdge(here.id);
    else useStore.getState().select(here.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [here?.id]);

  // Selecting on the canvas scrolls the document to that object · a
  // connection exactly as much as a resource.
  const selected = selectedId ?? selectedEdgeId;
  useEffect(() => {
    if (!selected || dirty || !box.current) return;
    if (fromCaret.current === selected) {
      fromCaret.current = null;
      return;
    }
    const at = draft.indexOf(`"id": "${selected}"`);
    if (at === -1) return;
    const el = box.current;
    el.scrollTop = Math.max(0, (lineOf(draft, at) - 4) * LINE_H);
    setCaretAt(at);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const edit = (next: TextEdit) => {
    caret.current = [next.selStart, next.selEnd];
    setCaretAt(next.selStart);
    setDraft(next.value);
  };

  const tone =
    status.tone === "bad" ? "var(--bad)" : status.tone === "ok" ? "var(--good)" : "var(--ink-3)";

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* The editor is three layers on one grid: a gutter of line numbers, a
          backdrop that bands the caret's line and its object, and the
          textarea itself, transparent, on top. They stay aligned because all
          three use the same LINE_H and the same padding, and the first two
          are translated by the textarea's own scrollTop. */}
      <div className="relative min-h-0 flex-1 overflow-hidden" style={{ background: "var(--panel-2)" }}>
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-0 w-[34px] select-none border-r text-right"
          style={{ borderColor: "var(--line)", background: "var(--panel)" }}
          aria-hidden
        >
          <div style={{ transform: `translateY(${PAD_Y - scroll}px)` }}>
            {Array.from({ length: lineCount }, (_, i) => (
              <div
                key={i}
                className="pr-1.5"
                style={{
                  height: LINE_H,
                  lineHeight: `${LINE_H}px`,
                  fontFamily: "var(--font-mono-jb)",
                  fontSize: 9.5,
                  color: i === caretLine ? "var(--accent-ink)" : "var(--ink-4)",
                }}
              >
                {i + 1}
              </div>
            ))}
          </div>
        </div>
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
          <div style={{ transform: `translateY(${PAD_Y - scroll}px)` }}>
            {band ? (
              <div
                className="absolute left-[34px] right-0"
                style={{
                  top: band.from * LINE_H,
                  height: (band.to - band.from + 1) * LINE_H,
                  background: "var(--accent-bg)",
                  opacity: 0.55,
                }}
              />
            ) : null}
            <div
              className="absolute left-[34px] right-0"
              style={{ top: caretLine * LINE_H, height: LINE_H, background: "var(--hover)" }}
            />
          </div>
        </div>
        <textarea
          ref={box}
          value={draft}
          spellCheck={false}
          onScroll={(e) => setScroll(e.currentTarget.scrollTop)}
          onSelect={(e) => readCaret(e.currentTarget)}
          onClick={(e) => readCaret(e.currentTarget)}
          onKeyUp={(e) => readCaret(e.currentTarget)}
          onChange={(e) => {
            readCaret(e.currentTarget);
            setDraft(e.target.value);
          }}
          onKeyDown={(e) => {
          const el = e.currentTarget;
          const at = [el.value, el.selectionStart, el.selectionEnd] as const;
          // Every letter here has to type a letter, so the canvas hotkeys are
          // off while this box has focus (Keyboard.tsx skips form fields).
          // Escape is the way out · it hands focus back and they work again.
          if (e.key === "Escape") {
            el.blur();
            return;
          }
          if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
            e.preventDefault();
            edit(onEnter(...at));
          } else if (e.key === "Tab" && !e.metaKey && !e.ctrlKey && !e.altKey) {
            e.preventDefault();
            edit(onTab(...at, e.shiftKey));
          } else if (e.key === "Backspace" && !e.metaKey && !e.ctrlKey && !e.altKey) {
            const next = onBackspace(...at);
            if (next) {
              e.preventDefault();
              edit(next);
            }
          }
        }}
          aria-label="The drawing as JSON"
          className="absolute inset-0 z-[1] resize-none bg-transparent outline-none"
          style={{
            fontFamily: "var(--font-mono-jb)",
            fontSize: 10.5,
            lineHeight: `${LINE_H}px`,
            padding: `${PAD_Y}px 8px ${PAD_Y}px 40px`,
            tabSize: 2,
          }}
        />
      </div>
      <div
        className="flex flex-none items-center gap-2 border-t px-3 py-2 text-[10.5px]"
        style={{ borderColor: "var(--line)", color: tone, fontFamily: "var(--font-mono-jb)" }}
      >
        <span
          className="h-[6px] w-[6px] flex-none rounded-full"
          style={{ background: tone, opacity: status.tone === "idle" ? 0.5 : 1 }}
        />
        <span className="truncate">{status.text}</span>
        {/* What the caret is inside · the same object the canvas just lit. */}
        {here ? (
          <span className="ml-auto flex-none truncate" style={{ color: "var(--accent-ink)" }} title={here.id}>
            in {here.id}
          </span>
        ) : null}
        {dirty ? (
          <button
            className="flex-none rounded-md px-1.5 py-0.5 hover:bg-[var(--hover)]"
            style={{ border: "1px solid var(--line-2)", color: "var(--ink-2)" }}
            onClick={() => {
              setDraft(live);
              setStatus({ tone: "idle", text: "in sync with the canvas" });
            }}
            data-tip="Throw away this edit and show the canvas again"
          >
            revert
          </button>
        ) : null}
      </div>
      <div className="flex-none px-3 pb-2 text-[10px] leading-snug" style={{ color: "var(--ink-4)" }}>
        Edits apply as you type, whenever the JSON parses. Your agent writes the same document with
        patch_state.
      </div>
    </div>
  );
}
