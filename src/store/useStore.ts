"use client";

// The one store. Every mutation lands here synchronously so a tool's
// next read sees reality — tools call these actions and return after.

import { create } from "zustand";
import type {
  ArchEdge,
  ArchGroup,
  ArchNode,
  EdgeKind,
  StateSnapshot,
  Traffic,
} from "@/engine/model";
import { DEFAULT_TRAFFIC } from "@/engine/model";
import type { PricingTable } from "@/engine/pricing";
import { autoLayout } from "@/engine/layout";
import { defaultSettings } from "@/engine/defineService";
import { getService } from "@/engine/services";
import use1 from "../../data/pricing.us-east-1.json";
import aps1 from "../../data/pricing.ap-southeast-1.json";

export const PRICING_TABLES: Record<string, PricingTable> = {
  "us-east-1": use1 as unknown as PricingTable,
  "ap-southeast-1": aps1 as unknown as PricingTable,
};

export type Layer = "request" | "events" | "data" | "security" | "cost";

let nextId = 1;
export function newId(prefix: string): string {
  return `${prefix}-${nextId++}`;
}

export interface OverheadState {
  nodes: ArchNode[];
  edges: ArchEdge[];
  groups: ArchGroup[];
  traffic: Traffic;
  region: string;
  layers: Record<Layer, boolean>;
  cardsForced: boolean;
  zoom: number;
  selectedId: string | null;
  hoveredId: string | null;

  // mutations (synchronous — tools depend on it)
  loadSnapshot: (snap: StateSnapshot) => void;
  addNode: (
    service: string,
    name: string,
    settings?: Record<string, unknown>,
    group?: string,
  ) => string;
  removeNode: (id: string) => void;
  moveNode: (id: string, x: number, y: number) => void;
  setNodeSetting: (id: string, key: string, value: unknown) => void;
  addEdge: (
    from: string,
    to: string,
    kind: EdgeKind,
    volumePerMonth?: number,
  ) => string;
  removeEdge: (id: string) => void;
  setTraffic: (traffic: Partial<Traffic>) => void;
  setRegion: (region: string) => void;
  applyAutoLayout: () => void;
  setLayer: (layer: Layer, on: boolean) => void;
  setCardsForced: (on: boolean) => void;
  setZoom: (zoom: number) => void;
  select: (id: string | null) => void;
  hover: (id: string | null) => void;
}

export const useStore = create<OverheadState>((set, get) => ({
  nodes: [],
  edges: [],
  groups: [],
  traffic: { ...DEFAULT_TRAFFIC },
  region: "ap-southeast-1",
  layers: { request: true, events: true, data: true, security: false, cost: false },
  cardsForced: false,
  zoom: 1,
  selectedId: null,
  hoveredId: null,

  loadSnapshot: (snap) =>
    set({
      nodes: snap.nodes.map((n) => ({ ...n })),
      edges: snap.edges.map((e) => ({ ...e })),
      groups: snap.groups.map((g) => ({ ...g })),
      traffic: { ...snap.traffic },
      selectedId: null,
      hoveredId: null,
    }),

  addNode: (service, name, settings, group) => {
    const def = getService(service);
    if (!def) throw new Error(`Unknown service "${service}"`);
    const id = newId(service);
    const node: ArchNode = {
      id,
      service: def.id,
      name,
      settings: { ...defaultSettings(def), ...settings },
      group,
      position: { x: 0, y: 0 },
    };
    const nodes = [...get().nodes, node];
    const positions = autoLayout(nodes);
    set({
      nodes: nodes.map((n) => ({ ...n, position: positions[n.id] ?? n.position })),
    });
    return id;
  },

  removeNode: (id) =>
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.from !== id && e.to !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
    })),

  moveNode: (id, x, y) =>
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, position: { x, y } } : n)),
    })),

  setNodeSetting: (id, key, value) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id ? { ...n, settings: { ...n.settings, [key]: value } } : n,
      ),
    })),

  addEdge: (from, to, kind, volumePerMonth) => {
    const id = newId("edge");
    set((s) => ({ edges: [...s.edges, { id, from, to, kind, volumePerMonth }] }));
    return id;
  },

  removeEdge: (id) => set((s) => ({ edges: s.edges.filter((e) => e.id !== id) })),

  setTraffic: (traffic) => set((s) => ({ traffic: { ...s.traffic, ...traffic } })),

  setRegion: (region) => {
    if (!PRICING_TABLES[region]) throw new Error(`No pricing for "${region}"`);
    set({ region });
  },

  applyAutoLayout: () =>
    set((s) => {
      const positions = autoLayout(s.nodes);
      return {
        nodes: s.nodes.map((n) => ({ ...n, position: positions[n.id] ?? n.position })),
      };
    }),

  setLayer: (layer, on) =>
    set((s) => ({ layers: { ...s.layers, [layer]: on } })),

  setCardsForced: (on) => set({ cardsForced: on }),
  setZoom: (zoom) => set({ zoom }),
  select: (id) => set({ selectedId: id }),
  hover: (id) => set({ hoveredId: id }),
}));

export function snapshotOf(s: OverheadState): StateSnapshot {
  return {
    nodes: s.nodes,
    edges: s.edges,
    groups: s.groups,
    traffic: s.traffic,
  };
}

export function pricingOf(s: OverheadState): PricingTable {
  return PRICING_TABLES[s.region];
}

/** Card mode when zoomed past 125%, forced, or the cost layer is on. */
export function cardModeOf(s: OverheadState): boolean {
  return s.cardsForced || s.zoom >= 1.25 || s.layers.cost;
}
