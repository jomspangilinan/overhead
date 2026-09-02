"use client";

// Drop a file anywhere on the canvas. Two kinds land here, and the
// extension says which: a Cost Explorer CSV becomes the bill summary
// (papaparse, in the tab), a CloudFormation template opens the import
// dialog. Both are read in the browser · nothing leaves it.

import { useCallback, useEffect, useState } from "react";
import Papa from "papaparse";
import { summarizeBill } from "@/engine/bill";
import { useStore } from "@/store/useStore";

const CSV = /\.csv$/i;
/** A template or a saved drawing · the dialog works out which from the content. */
const IMPORTABLE = /\.(ya?ml|json|template)$/i;

export function BillDrop() {
  const [dragging, setDragging] = useState(false);
  const bill = useStore((s) => s.bill);
  const setBill = useStore((s) => s.setBill);
  const setImportPanel = useStore((s) => s.setImportPanel);

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
      if (!file) return;
      if (CSV.test(file.name)) {
        e.preventDefault();
        onFile(file);
      } else if (IMPORTABLE.test(file.name)) {
        e.preventDefault();
        void file.text().then((template) => setImportPanel({ fileName: file.name, template }));
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
  }, [onFile, setImportPanel]);

  return (
    <>
      {dragging ? (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center border-4 border-dashed border-accent bg-panel/70">
          <div className="rounded-lg bg-panel px-6 py-4 text-[15px] font-medium shadow-lg">
            Drop a Cost Explorer CSV, a CloudFormation template or an Overhead file · read here, never uploaded
          </div>
        </div>
      ) : null}
      {bill ? (
        <div className="absolute bottom-4 left-4 z-40 flex items-center gap-3 rounded-lg border border-line bg-panel px-3 py-2 text-[12px] shadow-md">
          <span
            className="font-semibold"
            style={{ fontFamily: "var(--font-mono-jb)" }}
          >
            Bill: ${bill.total.toFixed(2)}
          </span>
          <span className="text-ink-3">
            {bill.lines.length} services · ${bill.mappedTotal.toFixed(2)} mappable
          </span>
          <button
            className="rounded border border-line px-2 py-0.5 hover:bg-panel-2"
            onClick={() => setBill(null)}
          >
            Clear
          </button>
        </div>
      ) : null}
    </>
  );
}
