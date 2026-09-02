"use client";

// The one store. Every mutation lands here synchronously so a tool's
// next read sees reality — tools call these actions and return after.

import { create } from "zustand";
import type {
  ArchEdge,
  Container,
  Section,
  ArchNode,
  EdgeKind,
  StateSnapshot,
  Traffic,
} from "@/engine/model";
import { DEFAULT_TRAFFIC } from "@/engine/model";
import type { PricingTable } from "@/engine/pricing";
import type { BillSummary } from "@/engine/bill";
import { autoLayout, autoLayoutWithSections, roleOf, placeInRole } from "@/engine/layout";
import {
  validateContainerParent,
  validateNodePlacement,
  wouldCycle,
  descendantIds,
  type ContainerKind,
  type PlacementError,
} from "@/engine/containers";
import { migrateSnapshot } from "@/engine/migrate";
import { defaultSettings } from "@/engine/defineService";
import { getService } from "@/engine/services";
import use1 from "../../data/pricing.us-east-1.json";
import aps1 from "../../data/pricing.ap-southeast-1.json";

export const PRICING_TABLES: Record<string, PricingTable> = {
  "us-east-1": use1 as unknown as PricingTable,
  "ap-southeast-1": aps1 as unknown as PricingTable,
};

export type Layer =
  | "request"
  | "events"
  | "data"
  | "security"
  | "cost"
  | "sections";

/** The rail's active tool. */
export type Tool =
  | "select"
  | "pan"
  | "add"
  | "connect"
  | "container"
  | "section"
  | "trace";

const SECTION_COLORS = ["#3B82F6", "#E7157B", "#F0B34E", "#7AA116", "#8C4FFF"];

let nextId = 1;
export function newId(prefix: string): string {
  return `${prefix}-${nextId++}`;
}

export interface OverheadState {
  nodes: ArchNode[];
  edges: ArchEdge[];
  containers: Container[];
  sections: Section[];
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
    container?: string,
    position?: { x: number; y: number },
  ) => string;
  tool: Tool;
  setTool: (tool: Tool) => void;
  gridOn: boolean;
  setGridOn: (on: boolean) => void;
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
  addContainer: (
    kind: ContainerKind,
    name: string,
    cidr?: string,
    parent?: string,
  ) => { id: string } | { error: PlacementError };
  moveIntoContainer: (
    nodeIds: string[],
    containerId: string | null,
  ) => { moved: number } | { error: PlacementError };
  setContainerCollapsed: (containerId: string, collapsed: boolean) => void;
  removeContainer: (containerId: string) => void;
  addSection: (
    name: string,
    nodeIds?: string[],
    color?: string,
    bounds?: Section["bounds"],
  ) => string;
  renameSection: (id: string, name: string) => void;
  setSectionNodes: (id: string, nodeIds: string[]) => void;
  removeSection: (id: string) => void;
  moveSection: (id: string, dx: number, dy: number) => void;
  openScenario: (name: string) => void;
  commitScenario: () => void;
  discardScenario: () => void;
}

export const useStore = create<OverheadState>((set, get) => ({
  nodes: [],
  edges: [],
  containers: [],
  sections: [],
  traffic: { ...DEFAULT_TRAFFIC },
  region: "ap-southeast-1",
  layers: {
    request: true,
    events: true,
    data: true,
    security: false,
    cost: false,
    sections: true,
  },
  cardsForced: false,
  zoom: 1,
  selectedId: null,
  selectedEdgeId: null,
  hoveredId: null,
  traceIds: null,
  scenario: null,
  exportPanel: null,
  bill: null,

  loadSnapshot: (raw) =>
    set(((): Partial<OverheadState> => {
      const snap = migrateSnapshot(raw);
      return {
      nodes: snap.nodes.map((n) => ({ ...n })),
      edges: snap.edges.map((e) => ({ ...e })),
      containers: snap.containers.map((c) => ({ ...c })),
      sections: snap.sections.map((x) => ({ ...x })),
      traffic: { ...snap.traffic },
      selectedId: null,
      hoveredId: null,
      };
    })()),

  addNode: (service, name, settings, container, position) => {
    const def = getService(service);
    if (!def) throw new Error(`Unknown service "${service}"`);
    const id = newId(service);
    const node: ArchNode = {
      id,
      service: def.id,
      name,
      settings: { ...defaultSettings(def), ...settings },
      container,
      position: { x: 0, y: 0 },
    };
    // New node lands in its lane's next free row (or where it was dropped);
    // existing nodes never move.
    node.position = position ?? placeInRole(get().nodes, roleOf(node));
    set((s) => ({ nodes: [...s.nodes, node] }));
    return id;
  },

  tool: "select",
  setTool: (tool) => set({ tool }),
  gridOn: true,
  setGridOn: (on) => set({ gridOn: on }),

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

  /** Re-running replaces the sections it made before; user sections survive. */
  applyAutoLayout: () =>
    set((s) => {
      const { positions, sections } = autoLayoutWithSections(s.nodes);
      return {
        nodes: s.nodes.map((n) => ({ ...n, position: positions[n.id] ?? n.position })),
        sections: [
          ...s.sections.filter((x) => !x.id.startsWith("auto-")),
          ...sections.map((x, i) => ({
            id: `auto-${i}`,
            name: x.name,
            color: x.color,
            nodeIds: x.nodeIds,
            collapsed: false,
          })),
        ],
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

  addContainer: (kind, name, cidr, parent) => {
    const s = get();
    const parentC = parent ? s.containers.find((c) => c.id === parent) : undefined;
    if (parent && !parentC)
      return {
        error: {
          code: "no_such_container" as const,
          message: `No container "${parent}".`,
        },
      };
    const err = validateContainerParent(kind, parentC?.kind ?? null);
    if (err) return { error: err };
    const id = newId(kind);
    set((st) => ({
      containers: [
        ...st.containers,
        { id, kind, name, cidr, parent, collapsed: false },
      ],
    }));
    return { id };
  },

  moveIntoContainer: (nodeIds, containerId) => {
    const s = get();
    const target = containerId
      ? s.containers.find((c) => c.id === containerId)
      : undefined;
    if (containerId && !target)
      return {
        error: {
          code: "no_such_container" as const,
          message: `No container "${containerId}".`,
        },
      };
    for (const id of nodeIds) {
      const node = s.nodes.find((n) => n.id === id);
      if (!node) continue;
      const err = validateNodePlacement(node.service, target?.kind ?? null);
      if (err) return { error: err };
    }
    set((st) => ({
      nodes: st.nodes.map((n) =>
        nodeIds.includes(n.id) ? { ...n, container: containerId ?? undefined } : n,
      ),
    }));
    return { moved: nodeIds.length };
  },

  setContainerCollapsed: (containerId, collapsed) =>
    set((s) => ({
      containers: s.containers.map((c) =>
        c.id === containerId ? { ...c, collapsed } : c,
      ),
    })),

  /** Children and members re-parent upward — removing a frame never
   *  silently deletes what was inside it. */
  removeContainer: (containerId) =>
    set((s) => {
      const own = s.containers.find((c) => c.id === containerId);
      const up = own?.parent;
      return {
        containers: s.containers
          .filter((c) => c.id !== containerId)
          .map((c) => (c.parent === containerId ? { ...c, parent: up } : c)),
        nodes: s.nodes.map((n) =>
          n.container === containerId ? { ...n, container: up } : n,
        ),
      };
    }),

  addSection: (name, nodeIds, color, bounds) => {
    const id = newId("section");
    set((s) => ({
      sections: [
        ...s.sections,
        {
          id,
          name,
          color: color ?? SECTION_COLORS[s.sections.length % SECTION_COLORS.length],
          nodeIds: nodeIds ?? [],
          bounds,
          collapsed: false,
        },
      ],
    }));
    return id;
  },

  renameSection: (id, name) =>
    set((s) => ({
      sections: s.sections.map((x) => (x.id === id ? { ...x, name } : x)),
    })),

  setSectionNodes: (id, nodeIds) =>
    set((s) => ({
      sections: s.sections.map((x) => (x.id === id ? { ...x, nodeIds } : x)),
    })),

  removeSection: (id) =>
    set((s) => ({ sections: s.sections.filter((x) => x.id !== id) })),

  /** One action so undo captures the frame and its members as a single step. */
  moveSection: (id, dx, dy) =>
    set((s) => {
      const section = s.sections.find((x) => x.id === id);
      if (!section) return {};
      const members = new Set(section.nodeIds);
      return {
        sections: s.sections.map((x) =>
          x.id === id && x.bounds
            ? { ...x, bounds: { ...x.bounds, x: x.bounds.x + dx, y: x.bounds.y + dy } }
            : x,
        ),
        nodes: s.nodes.map((n) =>
          members.has(n.id)
            ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }
            : n,
        ),
      };
    }),

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
    containers: s.containers,
    sections: s.sections,
    traffic: s.traffic,
  };
}

export function pricingOf(s: OverheadState): PricingTable {
  return PRICING_TABLES[s.region];
}

/** Card mode when zoomed past 125%, forced, or the cost layer is on. */
export function cardModeOf(s: OverheadState): boolean {
  return s.cardsForced || s.zoom >= 1.3 || s.layers.cost;
}
