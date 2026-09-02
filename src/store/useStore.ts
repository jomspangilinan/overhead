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
import type { BillSummary } from "@/engine/bill";
import { autoLayout, laneOf, placeInLane } from "@/engine/layout";
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
  selectedEdgeId: string | null;
  hoveredId: string | null;
  traceIds: string[] | null;
  scenario: { name: string; base: StateSnapshot } | null;
  exportPanel: "json" | "markdown" | "mermaid" | "cdk" | "svg" | null;
  bill: BillSummary | null;

  // mutations (synchronous — tools depend on it)
  loadSnapshot: (snap: StateSnapshot) => void;
  addNode: (
    service: string,
    name: string,
    settings?: Record<string, unknown>,
    group?: string,
    position?: { x: number; y: number },
  ) => string;
  showLanes: boolean;
  setShowLanes: (on: boolean) => void;
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
  selectEdge: (id: string | null) => void;
  hover: (id: string | null) => void;
  setTrace: (ids: string[] | null) => void;
  setExportPanel: (format: OverheadState["exportPanel"]) => void;
  setBill: (bill: BillSummary | null) => void;
  addGroup: (kind: ArchGroup["kind"], name: string, cidr?: string, parent?: string) => string;
  moveIntoGroup: (nodeIds: string[], groupId: string | null) => void;
  setGroupCollapsed: (groupId: string, collapsed: boolean) => void;
  openScenario: (name: string) => void;
  commitScenario: () => void;
  discardScenario: () => void;
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
  selectedEdgeId: null,
  hoveredId: null,
  traceIds: null,
  scenario: null,
  exportPanel: null,
  bill: null,

  loadSnapshot: (snap) =>
    set({
      nodes: snap.nodes.map((n) => ({ ...n })),
      edges: snap.edges.map((e) => ({ ...e })),
      groups: snap.groups.map((g) => ({ ...g })),
      traffic: { ...snap.traffic },
      selectedId: null,
      hoveredId: null,
    }),

  addNode: (service, name, settings, group, position) => {
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
    // New node lands in its lane's next free row (or where it was dropped);
    // existing nodes never move.
    node.position = position ?? placeInLane(get().nodes, laneOf(node));
    set((s) => ({ nodes: [...s.nodes, node] }));
    return id;
  },

  showLanes: true,
  setShowLanes: (on) => set({ showLanes: on }),

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
  select: (id) => set({ selectedId: id, ...(id ? { selectedEdgeId: null } : {}) }),
  selectEdge: (id) => set({ selectedEdgeId: id, ...(id ? { selectedId: null } : {}) }),
  hover: (id) => set({ hoveredId: id }),
  setTrace: (ids) => set({ traceIds: ids }),
  setExportPanel: (format) => set({ exportPanel: format }),
  setBill: (bill) => set({ bill }),

  addGroup: (kind, name, cidr, parent) => {
    const id = newId("group");
    set((s) => ({
      groups: [...s.groups, { id, kind, name, cidr, parent, collapsed: false }],
    }));
    return id;
  },

  moveIntoGroup: (nodeIds, groupId) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        nodeIds.includes(n.id) ? { ...n, group: groupId ?? undefined } : n,
      ),
    })),

  setGroupCollapsed: (groupId, collapsed) =>
    set((s) => ({
      groups: s.groups.map((g) => (g.id === groupId ? { ...g, collapsed } : g)),
    })),

  // While a scenario is open, the live state IS the fork; base is frozen.
  openScenario: (name) => {
    const s = get();
    if (s.scenario) throw new Error(`Scenario "${s.scenario.name}" is already open.`);
    set({
      scenario: {
        name,
        base: structuredClone(snapshotOf(s)),
      },
    });
  },

  commitScenario: () => set({ scenario: null }),

  discardScenario: () => {
    const base = get().scenario?.base;
    if (base) {
      get().loadSnapshot(base);
    }
    set({ scenario: null });
  },
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
