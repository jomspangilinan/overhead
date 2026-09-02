"use client";

// Drop a Cost Explorer CSV anywhere on the canvas. Parsed in the tab with
// papaparse; the summary lands in the store for get_bill_summary /
// reconstruct_from_bill. Nothing leaves the browser.

import { useCallback, useEffect, useState } from "react";
import Papa from "papaparse";
import { summarizeBill } from "@/engine/bill";
import { useStore } from "@/store/useStore";

export function BillDrop() {
  const [dragging, setDragging] = useState(false);
  const bill = useStore((s) => s.bill);
  const setBill = useStore((s) => s.setBill);

  const onFile = useCallback(
    (file: File) => {
      Papa.parse<string[]>(file, {
        skipEmptyLines: true,
        complete: (res) => {
          const summary = summarizeBill(res.data as string[][]);
          setBill(summary);
        },
      });
    },
    [setBill],
  );

  useEffect(() => {
    const over = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) {
        e.preventDefault();
        setDragging(true);
      }
    };
    const leave = () => setDragging(false);
    const drop = (e: DragEvent) => {
      setDragging(false);
      const file = e.dataTransfer?.files?.[0];
      if (file && /\.csv$/i.test(file.name)) {
        e.preventDefault();
        onFile(file);
      }
    };
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, [onFile]);

  return (
    <>
      {dragging ? (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center border-4 border-dashed border-accent bg-surface/70">
          <div className="rounded-lg bg-surface px-6 py-4 text-[15px] font-medium shadow-lg">
            Drop a Cost Explorer CSV — parsed here, never uploaded
          </div>
        </div>
      ) : null}
      {bill ? (
        <div className="absolute bottom-4 left-4 z-40 flex items-center gap-3 rounded-lg border border-rule bg-surface px-3 py-2 text-[12px] shadow-md">
          <span
            className="font-semibold"
            style={{ fontFamily: "var(--font-plex-mono)" }}
          >
            Bill: ${bill.total.toFixed(2)}
          </span>
          <span className="text-ink-3">
            {bill.lines.length} services · ${bill.mappedTotal.toFixed(2)} mappable
          </span>
          <button
            className="rounded border border-rule px-2 py-0.5 hover:bg-surface-2"
            onClick={() => setBill(null)}
          >
            Clear
          </button>
        </div>
      ) : null}
    </>
  );
}
