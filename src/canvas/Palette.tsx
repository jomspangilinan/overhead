"use client";

// The Add panel's body: a search row, the ten services as a 5-column icon
// grid (click to add, drag to place), then the container kinds.

import { useState } from "react";
import { SERVICES } from "@/engine/services";
import { useStore } from "@/store/useStore";
import { Icon } from "./Icon";

const CONTAINERS: { kind: string; label: string; color: string; icon: string }[] = [
  { kind: "cloud", label: "AWS Cloud", color: "#8B97A8", icon: "aws-group-cloud" },
  { kind: "region", label: "Region", color: "#00A4A6", icon: "aws-group-region" },
  { kind: "vpc", label: "VPC", color: "#8C4FFF", icon: "aws-group-vpc" },
  {
    kind: "subnetpub",
    label: "Public subnet",
    color: "#7AA116",
    icon: "aws-group-public",
  },
  {
    kind: "subnetpri",
    label: "Private subnet",
    color: "#00A4A6",
    icon: "aws-group-private",
  },
];

function Caption({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="col-span-full px-[3px] pb-[3px] pt-2 text-[9px] uppercase tracking-[0.13em]"
      style={{ color: "var(--ink-4)" }}
    >
      {children}
    </div>
  );
}

export function Palette() {
  const addNode = useStore((s) => s.addNode);
  const select = useStore((s) => s.select);
  const count = useStore((s) => s.nodes.length);
  const [q, setQ] = useState("");

  const services = Object.values(SERVICES).filter((def) =>
    q ? def.term.toLowerCase().includes(q.toLowerCase()) : true,
  );

  return (
    <div>
      <label
        className="mx-2.5 my-2 flex items-center gap-2 rounded-lg px-[9px] py-1.5 text-[11.5px]"
        style={{
          background: "var(--panel-2)",
          border: "1px solid var(--line)",
          color: "var(--ink-4)",
        }}
      >
        <Icon name="search" size={13} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search"
          className="w-full bg-transparent outline-none"
          style={{ color: "var(--ink-2)" }}
        />
      </label>

      <div className="grid grid-cols-5 gap-0.5 px-2 pb-2.5">
        <Caption>Services</Caption>
        {services.map((def) => (
          <button
            key={def.id}
            title={`${def.term} — click to add, or drag onto the canvas`}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("application/overhead-service", def.id);
              e.dataTransfer.effectAllowed = "copy";
            }}
            className="grid aspect-square cursor-grab place-items-center rounded-[9px] hover:bg-[var(--hover)] active:cursor-grabbing"
            onClick={() => select(addNode(def.id, `${def.id}-${count + 1}`))}
          >
            <svg width="24" height="24">
              <use href={`#${def.icon}`} width="24" height="24" />
            </svg>
          </button>
        ))}

        <Caption>Containers</Caption>
        {CONTAINERS.map((c) => (
          <div
            key={c.kind}
            className="col-span-full flex items-center gap-[7px] rounded-lg p-1.5 text-[10.5px]"
            style={{ color: "var(--ink-2)" }}
            title="Ask your agent for these — add_container"
          >
            <svg width="18" height="18" style={{ color: c.color }}>
              <use href={`#${c.icon}`} width="18" height="18" />
            </svg>
            {c.label}
          </div>
        ))}
      </div>
    </div>
  );
}
