"use client";

// The drawing as a Mermaid flowchart you can type into.
//
// The Code tab is the whole document, exactly; this is the same drawing in
// the notation people already write architecture in. Everything the canvas
// can do to the shape of a design can be done here in three words:
// `api --> fn` adds a connection, deleting a line removes a node, renaming a
// label renames a resource. The total re-prices as you type, which is the
// part a Mermaid editor has never been able to do.
//
// It is a third writer on one document, so it obeys the same two rules the
// Code tab does · nothing writes over you while you type (the store re-seeds
// only when the panel is clean and unfocused, and a write of our own is
// remembered so the round trip does not reformat what you are typing), and
// applying goes through the engine rather than around it.
//
// What is different, and why: Mermaid is **lossy**. It has no syntax for a
// position, a memory size, a traffic figure or an edge's volume. So this
// panel never rebuilds the drawing · `applyMermaid` merges the parsed
// document into the live one **by id**, exactly the way `patch_state` does,
// and everything the text did not mention is left alone. Drag a node, then
// type here: the drag survives.
//
// The last line is a `%% overhead:` comment carrying what Mermaid cannot say
// (which service each node is, what kind each subgraph is). It is a comment,
// so the document is still a plain flowchart anywhere else · and without it
// a node named "worker" would have nothing to say it is a Lambda.

import { useEffect, useMemo, useRef, useState } from "react";
import { useStore, pricingOf } from "@/store/useStore";
import { exportMermaid } from "@/engine/exporters/mermaid";
import { applyMermaid, importMermaid } from "@/engine/iac/mermaid";
import type { StateSnapshot } from "@/engine/model";
import { LiveEditor, EditorStatus, LINE_H } from "./LiveEditor";

const DEBOUNCE = 300;

/** The first id on a line · what the caret is "in" here. Mermaid has no
 *  nesting to walk, so a line is the unit, which is also how it reads. */
function idOnLine(line: string): string | null {
  const t = line.trim();
  if (!t || t.startsWith("%%") || /^(flowchart|graph|end|subgraph|classDef|class|style|linkStyle)\b/.test(t))
    return null;
  return /^[A-Za-z0-9_]+(?:-[A-Za-z0-9_]+)*/.exec(t)?.[0] ?? null;
}

export function MermaidPanel() {
  const nodes = useStore((s) => s.nodes);
  const edges = useStore((s) => s.edges);
  const containers = useStore((s) => s.containers);
  const sections = useStore((s) => s.sections);
  const traffic = useStore((s) => s.traffic);
  const selectedId = useStore((s) => s.selectedId);
  const pricing = useStore(pricingOf);
  const loadSnapshot = useStore((s) => s.loadSnapshot);

  const snap = useMemo<StateSnapshot>(
    () => ({ nodes, edges, containers, sections, traffic }),
    [nodes, edges, containers, sections, traffic],
  );
  // No figures in the text: a monthly cost is derived, and a derived number
  // in an editable box reads as an input you are allowed to change.
  const live = useMemo(() => exportMermaid(snap, pricing, { cost: false }), [snap, pricing]);

  const box = useRef<HTMLTextAreaElement>(null);
  /** The last text we applied · a store change that matches it is our own. */
  const ours = useRef<string | null>(null);
  const [draft, setDraft] = useState(live);
  const [caretAt, setCaretAt] = useState(0);
  const [status, setStatus] = useState<{ tone: "ok" | "bad" | "idle"; text: string }>({
    tone: "idle",
    text: "in sync with the canvas",
  });

  const dirty = draft !== live && ours.current !== draft;

  // The canvas changed under us · adopt it, unless the user is mid-edit.
  useEffect(() => {
    if (ours.current === draft) {
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

  // Typing · parse, and on a readable flowchart redraw.
  useEffect(() => {
    if (draft === live || ours.current === draft) return;
    const t = setTimeout(() => {
      const parsed = importMermaid(draft);
      if (!parsed.ok) {
        setStatus({ tone: "bad", text: parsed.message });
        return;
      }
      const next = applyMermaid(
        { nodes, edges, containers, sections, traffic },
        parsed.snapshot,
        parsed.statedServices,
      );
      ours.current = draft;
      loadSnapshot(next);
      const added = next.nodes.length - nodes.length;
      setStatus({
        tone: "ok",
        text:
          added === 0
            ? "applied"
            : added > 0
              ? `applied · ${added} added`
              : `applied · ${-added} removed`,
      });
    }, DEBOUNCE);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  // The caret's line is the object · band it, name it, and light it on the
  // canvas. The same loop the Code tab has, one line deep instead of one
  // object deep, because that is what a Mermaid statement is.
  const lines = useMemo(() => draft.split("\n"), [draft]);
  const caretLine = useMemo(() => draft.slice(0, caretAt).split("\n").length - 1, [draft, caretAt]);
  const here = useMemo(() => {
    const id = idOnLine(lines[caretLine] ?? "");
    return id && nodes.some((n) => n.id === id) ? id : null;
  }, [lines, caretLine, nodes]);
  const band = here ? { from: caretLine, to: caretLine } : null;

  const fromCaret = useRef<string | null>(null);
  useEffect(() => {
    if (!here || here === selectedId) return;
    fromCaret.current = here;
    useStore.getState().select(here);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [here]);

  // Selecting on the canvas scrolls the document to that node's line.
  useEffect(() => {
    if (!selectedId || dirty || !box.current) return;
    if (fromCaret.current === selectedId) {
      fromCaret.current = null;
      return;
    }
    const at = lines.findIndex((l) => idOnLine(l) === selectedId);
    if (at === -1) return;
    box.current.scrollTop = Math.max(0, (at - 4) * LINE_H);
    setCaretAt(lines.slice(0, at).join("\n").length + (at ? 1 : 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <LiveEditor
        value={draft}
        onEdit={(next) => setDraft(next.value)}
        caretAt={caretAt}
        onCaretAt={setCaretAt}
        band={band}
        ariaLabel="The drawing as a Mermaid flowchart"
        boxRef={box}
      />
      <EditorStatus
        tone={status.tone}
        text={status.text}
        here={here}
        onRevert={
          dirty
            ? () => {
                setDraft(live);
                setStatus({ tone: "idle", text: "in sync with the canvas" });
              }
            : undefined
        }
        hint="Edits apply as you type. A label that names a service (`fn[Lambda worker]`) becomes that service, priced; anything else stays a shape. The last line carries what Mermaid has no syntax for."
      />
    </div>
  );
}
