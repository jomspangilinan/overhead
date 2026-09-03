"use client";

// The text editor both document tabs are made of · Code (JSON) and Mermaid.
//
// It is three layers on one grid: a gutter of line numbers, a backdrop that
// bands the caret's line and the object it sits in, and the textarea itself,
// transparent, on top. They stay aligned because all three use the same
// LINE_H and padding, and the first two are translated by the textarea's own
// scrollTop.
//
// Everything *semantic* stays in the panel that uses it · what a document
// means, what a band covers, what applying does. This owns only the parts
// that would otherwise be typed twice: the layers, the indent behaviour, the
// caret restore after a controlled write, and Escape as the way back to the
// canvas hotkeys.

import { useEffect, useRef, useState, type RefObject } from "react";
import { onBackspace, onEnter, onTab, type TextEdit } from "./textIndent";

/** One line, everywhere · the gutter, the bands and the textarea share it. */
export const LINE_H = 16;
export const PAD_Y = 10;

export function LiveEditor({
  value,
  onEdit,
  caretAt,
  onCaretAt,
  band,
  ariaLabel,
  boxRef,
}: {
  value: string;
  /** Every write, typed or indent-driven · carries the caret with it. */
  onEdit: (next: TextEdit) => void;
  caretAt: number;
  onCaretAt: (at: number) => void;
  /** Lines to band, 0-based and inclusive · the object the caret is in. */
  band: { from: number; to: number } | null;
  ariaLabel: string;
  /** The panel keeps a ref when it needs to scroll the document itself. */
  boxRef?: RefObject<HTMLTextAreaElement | null>;
}) {
  const own = useRef<HTMLTextAreaElement>(null);
  const box = boxRef ?? own;
  // The box is controlled, so an indent edit has to put the caret back
  // itself once React has written the new text.
  const caret = useRef<[number, number] | null>(null);
  const [scroll, setScroll] = useState(0);

  useEffect(() => {
    if (!caret.current || !box.current) return;
    box.current.setSelectionRange(caret.current[0], caret.current[1]);
    caret.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const edit = (next: TextEdit) => {
    caret.current = [next.selStart, next.selEnd];
    onCaretAt(next.selStart);
    onEdit(next);
  };

  const lineCount = value.split("\n").length;
  const caretLine = value.slice(0, caretAt).split("\n").length - 1;
  const read = (el: HTMLTextAreaElement) => onCaretAt(el.selectionStart);

  return (
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
        value={value}
        spellCheck={false}
        onScroll={(e) => setScroll(e.currentTarget.scrollTop)}
        onSelect={(e) => read(e.currentTarget)}
        onClick={(e) => read(e.currentTarget)}
        onKeyUp={(e) => read(e.currentTarget)}
        onChange={(e) => {
          read(e.currentTarget);
          onEdit({ value: e.target.value, selStart: e.currentTarget.selectionStart, selEnd: e.currentTarget.selectionEnd });
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
        aria-label={ariaLabel}
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
  );
}

/** The status line both panels end with · one dot, one message, one hint. */
export function EditorStatus({
  tone,
  text,
  here,
  onRevert,
  hint,
}: {
  tone: "ok" | "bad" | "idle";
  text: string;
  /** The id of the object the caret is in, if any. */
  here?: string | null;
  onRevert?: () => void;
  hint: string;
}) {
  const color = tone === "bad" ? "var(--bad)" : tone === "ok" ? "var(--good)" : "var(--ink-3)";
  return (
    <>
      <div
        className="flex flex-none items-center gap-2 border-t px-3 py-2 text-[10.5px]"
        style={{ borderColor: "var(--line)", color, fontFamily: "var(--font-mono-jb)" }}
      >
        <span
          className="h-[6px] w-[6px] flex-none rounded-full"
          style={{ background: color, opacity: tone === "idle" ? 0.5 : 1 }}
        />
        <span className="truncate">{text}</span>
        {here ? (
          <span className="ml-auto flex-none truncate" style={{ color: "var(--accent-ink)" }} title={here}>
            in {here}
          </span>
        ) : null}
        {onRevert ? (
          <button
            className="flex-none rounded-md px-1.5 py-0.5 hover:bg-[var(--hover)]"
            style={{ border: "1px solid var(--line-2)", color: "var(--ink-2)" }}
            onClick={onRevert}
            data-tip="Throw away this edit and show the canvas again"
          >
            revert
          </button>
        ) : null}
      </div>
      <div className="flex-none px-3 pb-2 text-[10px] leading-snug" style={{ color: "var(--ink-4)" }}>
        {hint}
      </div>
    </>
  );
}
