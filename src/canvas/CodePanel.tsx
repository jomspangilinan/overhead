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
import { lineOf, objectAt, objectRanges } from "./codeRanges";
import { LiveEditor, EditorStatus, LINE_H } from "./LiveEditor";

const DEBOUNCE = 300;

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

  // Where the caret is · which line, and which object holds it. Recomputed
  // from the text, never from a parse: the caret moves most while the
  // document is mid-edit, which is exactly when a parse is unavailable.
  const ranges = useMemo(() => objectRanges(draft), [draft]);
  const [caretAt, setCaretAt] = useState(0);
  const here = useMemo(() => objectAt(ranges, caretAt), [ranges, caretAt]);
  const band = useMemo(
    () => (here ? { from: lineOf(draft, here.start), to: lineOf(draft, here.end) } : null),
    [draft, here],
  );
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

  return (
    <div className="flex h-full min-h-0 flex-col">
      <LiveEditor
        value={draft}
        onEdit={(next) => setDraft(next.value)}
        caretAt={caretAt}
        onCaretAt={setCaretAt}
        band={band}
        ariaLabel="The drawing as JSON"
        boxRef={box}
      />
      <EditorStatus
        tone={status.tone}
        text={status.text}
        here={here?.id ?? null}
        onRevert={
          dirty
            ? () => {
                setDraft(live);
                setStatus({ tone: "idle", text: "in sync with the canvas" });
              }
            : undefined
        }
        hint="Edits apply as you type, whenever the JSON parses. Your agent writes the same document with patch_state."
      />
    </div>
  );
}
