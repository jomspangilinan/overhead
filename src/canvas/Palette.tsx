"use client";

// Left rail: the ten services. Click to add a node (auto-laid into its lane).

import { SERVICES } from "@/engine/services";
import { useStore } from "@/store/useStore";

export function Palette() {
  const addNode = useStore((s) => s.addNode);
  const select = useStore((s) => s.select);
  const count = useStore((s) => s.nodes.length);

  return (
    <aside className="flex w-[92px] shrink-0 flex-col gap-1 overflow-y-auto border-r border-rule bg-surface p-2">
      <div
        className="mb-1 text-center text-[9px] font-semibold uppercase tracking-widest text-ink-3"
        style={{ fontFamily: "var(--font-archivo)" }}
      >
        Services
      </div>
      {Object.values(SERVICES).map((def) => (
        <button
          key={def.id}
          title={`Add ${def.term}`}
          className="flex flex-col items-center gap-0.5 rounded p-1.5 hover:bg-surface-2"
          onClick={() => {
            const id = addNode(def.id, `${def.id}-${count + 1}`);
            select(id);
          }}
        >
          <svg width="30" height="30">
            <use href={`#${def.icon}`} width="30" height="30" />
          </svg>
          <span className="text-[9px] leading-tight text-ink-2">
            {def.term.replace(/^(AWS|Amazon) /, "")}
          </span>
        </button>
      ))}
    </aside>
  );
}
