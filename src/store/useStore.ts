"use client";

// The one store. Every mutation lands here synchronously so a tool's
// next read sees reality — tools call these actions and return after.

import { create } from "zustand";
import type {
  ArchEdge,
  EdgeStyle,
  Side,
  SectionStyle,
  CardShow,
  CostDisplay,
  Container,
  Section,
  ArchNode,
  EdgeKind,
  StateSnapshot,
  Traffic,
} from "@/engine/model";
import { DEFAULT_TRAFFIC, DEFAULT_CARD_SHOW, DEFAULT_COST_DISPLAY } from "@/engine/model";
import type { PricingTable } from "@/engine/pricing";
import type { BillSummary } from "@/engine/bill";
import type { ImportFormat } from "@/engine/iac/import";
import type { Peer } from "@/net/protocol";
import { autoLayoutWithSections, roleOf, placeInRole } from "@/engine/layout";
import {
  wouldCycle,
  type ContainerKind,
  type PlacementError,
} from "@/engine/containers";
import { migrateSnapshot } from "@/engine/migrate";
import { removeObjects } from "@/engine/remove";
import { sectionMembersDeep } from "@/engine/layers";
import { defaultSettings } from "@/engine/defineService";
import { getService } from "@/engine/services";
import {
  clampBounds,
  contentBoxes,
  frameBoxes,
  placeNewFrame,
  translateFrame,
  sectionContentBox,
  type Bounds,
} from "@/engine/frames";
import { NODE_W, NODE_H, ICON_DRAW_W, ICON_DRAW_H } from "@/canvas/nodeMetrics";
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

export interface Notice {
  message: string;
  tone: "info" | "warn" | "bad";
}
export type WebmcpOutcome =
  | "checking"
  | "registered"
  | "no-model-context"
  | "in-iframe"
  | "error";

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
  exportPanel: "json" | "markdown" | "mermaid" | "cdk" | "cloudformation" | "png" | "svg" | "pdf" | null;
  /** A file waiting to be reconciled with the drawing. The diff itself is
   *  derived in the dialog · only the text the user handed us is state.
   *  `format` is the pinned entry in the dialog's list; absent = read the
   *  file as whatever it turns out to be. */
  importPanel: {
    fileName: string;
    template: string;
    format?: ImportFormat;
    /** The entry lit in the dialog's list · a format, or `sample:<name>`. */
    source?: string;
    /** The drawing name to adopt on replace (a sample brings its own). */
    drawingName?: string;
  } | null;
  bill: BillSummary | null;
  /** A live room · null unless the URL carries one (`net/room.ts`). Nothing
   *  contacts a server until this is set. */
  room: {
    id: string;
    me?: string;
    peers: Peer[];
    /** I opened this room · leaving closes it for everyone. */
    host?: boolean;
    status: "connecting" | "live" | "reconnecting";
  } | null;
  setRoom: (patch: Partial<NonNullable<OverheadState["room"]>> | null) => void;

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
  // shell
  leftDock: boolean;
  rightDock: boolean;
  /** Which view the right dock shows · the form, or the document. */
  rightTab: "inspector" | "code" | "mermaid";
  setRightTab: (tab: "inspector" | "code" | "mermaid") => void;
  setLeftDock: (open: boolean) => void;
  setRightDock: (open: boolean) => void;
  /** The floating Add palette (services + container kinds). */
  palette: boolean;
  setPalette: (open: boolean) => void;
  /** One transient message over the canvas — a refused drop, a created frame. */
  notice: Notice | null;
  notify: (message: string, tone?: Notice["tone"]) => void;
  clearNotice: () => void;
  /** The node currently being dragged on the canvas; frames leave it out. */
  draggingId: string | null;
  setDragging: (id: string | null) => void;
  /** A container frame mid-drag: rendered with this offset, committed on release. */
  /** A frame (container or section) mid-drag: preview offset, committed once on release. */
  frameDrag: { kind: "container" | "section"; id: string; dx: number; dy: number } | null;
  setFrameDrag: (d: OverheadState["frameDrag"]) => void;
  drawingName: string;
  setDrawingName: (name: string) => void;
  /** Published by WebMCPProvider (mounted at the root) for the agent strip. */
  webmcpOutcome: WebmcpOutcome;
  setWebmcpOutcome: (o: WebmcpOutcome) => void;
  renameNode: (id: string, name: string) => void;
  renameContainer: (id: string, name: string, cidr?: string) => void;
  setEdge: (id: string, patch: Partial<Omit<ArchEdge, "id" | "from" | "to">>) => void;
  /** Visual only — never touches `kind`. Undefined values clear a key. */
  setEdgeStyle: (id: string, patch: Partial<EdgeStyle>) => void;
  setEdgeAnchors: (id: string, anchors: ArchEdge["anchors"] | undefined) => void;
  setWaypoints: (id: string, waypoints: { x: number; y: number }[] | undefined) => void;
  removeWaypoint: (id: string, index: number) => void;
  removeNode: (id: string) => void;
  moveNode: (id: string, x: number, y: number) => void;
  /** Reorder: put a node beside another in the list (Layers drag). */
  placeNodeBeside: (id: string, targetId: string, where: "before" | "after") => void;
  setNodeSetting: (id: string, key: string, value: unknown) => void;
  addEdge: (
    from: string,
    to: string,
    kind: EdgeKind,
    volumePerMonth?: number,
    extra?: Pick<ArchEdge, "anchors" | "style" | "label">,
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
  /** Index into the selected edge's waypoints (Delete removes it). */
  selectedWaypoint: number | null;
  setSelectedWaypoint: (i: number | null) => void;
  /** Edge whose label is being edited inline on the canvas. */
  labelEditingEdgeId: string | null;
  setLabelEditing: (id: string | null) => void;
  /** A connection drag is in progress (cursor + handles). */
  connecting: boolean;
  setConnecting: (on: boolean) => void;
  /** A "+" pad or a drag onto empty canvas: the palette will add a node
   *  beside `fromNodeId` and connect it. `at` is the flow position for the
   *  new node; `screen` is where to open the palette (canvas-relative). */
  pendingConnection: {
    fromNodeId: string;
    side: Exclude<Side, "auto">;
    at: { x: number; y: number };
    screen: { x: number; y: number };
  } | null;
  setPendingConnection: (p: OverheadState["pendingConnection"]) => void;
  hover: (id: string | null) => void;
  setTrace: (ids: string[] | null) => void;
  setExportPanel: (format: OverheadState["exportPanel"]) => void;
  setImportPanel: (panel: OverheadState["importPanel"]) => void;
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
  /** Translate a frame and everything inside it, one undo step. */
  moveContainer: (containerId: string, dx: number, dy: number) => void;
  /** Re-parent a frame (undefined = top level); refuses only a cycle. */
  setContainerParent: (containerId: string, parentId: string | undefined) => { ok: true } | { error: PlacementError };
  /** Store explicit bounds (clamped to the content floor); `undefined` returns to derived. */
  setContainerBounds: (containerId: string, bounds: Bounds | undefined) => void;
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
  setSectionBounds: (id: string, bounds: Section["bounds"] | undefined) => void;
  setSectionColor: (id: string, color: string) => void;
  setSectionCollapsed: (id: string, collapsed: boolean) => void;
  setSectionStyle: (id: string, patch: Partial<SectionStyle>) => void;
  setSectionParent: (id: string, parentId: string | undefined) => void;
  /** ⌘G: the selected nodes become a group (a frameless section). */
  addGroup: (nodeIds: string[], name?: string) => string | null;
  ungroup: (id: string) => void;
  /** Per-node card presentation (the card gear). */
  setNodeCard: (id: string, patch: Partial<NonNullable<ArchNode["card"]>> | undefined) => void;
  cardShow: CardShow;
  setCardShow: (patch: Partial<CardShow>) => void;
  costDisplay: CostDisplay;
  setCostDisplay: (patch: Partial<CostDisplay>) => void;
  /** One anchored popover at a time: a card / section / cost / cards gear.
   *  x,y are canvas-relative. */
  popover: { kind: "card" | "canvas"; id?: string; x: number; y: number } | null;
  setPopover: (p: OverheadState["popover"]) => void;
  /** Multi-selection on the canvas (marquee, shift-click, a selected
   *  section's members). `selectedId` stays the primary selection. */
  selectedIds: string[];
  /** ⌘A · everything in the drawing. */
  selectAll: () => void;
  /** Delete · everything selected, in one undo step. */
  removeSelection: () => void;
  setSelectedIds: (ids: string[]) => void;
  openScenario: (name: string) => void;
  /** Rename the open fork · the banner's name is an input, not a prompt. */
  renameScenario: (name: string) => void;
  commitScenario: () => void;
  discardScenario: () => void;
}

/** Re-arrange when card mode has just flipped · one place, so K, the View
 *  gear, the Cost layer and the zoom all behave the same. Nothing to arrange
 *  on an empty canvas, and nothing to do when the mode did not change (the
 *  zoom fires on every wheel tick and crosses the threshold once). */
function retidy(get: () => OverheadState, was: boolean) {
  const s = get();
  if (!s.nodes.length || cardModeOf(s) === was) return;
  s.applyAutoLayout();
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
  importPanel: null,
  bill: null,
  room: null,
  setRoom: (patch) =>
    set((st) => ({
      room: patch === null ? null : st.room ? { ...st.room, ...patch } : ({ id: "", peers: [], status: "connecting", ...patch } as OverheadState["room"]),
    })),

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

  leftDock: true,
  rightDock: true,
  rightTab: "inspector",
  setRightTab: (rightTab) => set({ rightTab }),
  setLeftDock: (open) => set({ leftDock: open }),
  setRightDock: (open) => set({ rightDock: open }),
  palette: false,
  setPalette: (open) => set({ palette: open }),
  notice: null,
  notify: (message, tone = "info") => set({ notice: { message, tone } }),
  clearNotice: () => set({ notice: null }),
  draggingId: null,
  setDragging: (id) => set({ draggingId: id }),
  frameDrag: null,
  setFrameDrag: (d) => set({ frameDrag: d }),
  drawingName: "untitled",
  setDrawingName: (name) => set({ drawingName: name.trim() || "untitled" }),
  webmcpOutcome: "checking",
  setWebmcpOutcome: (o) => set({ webmcpOutcome: o }),

  renameNode: (id, name) =>
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, name: name.trim() || n.name } : n)),
    })),

  renameContainer: (id, name, cidr) =>
    set((s) => ({
      containers: s.containers.map((c) =>
        c.id === id
          ? { ...c, name: name.trim() || c.name, ...(cidr !== undefined ? { cidr: cidr || undefined } : {}) }
          : c,
      ),
    })),

  setEdge: (id, patch) =>
    set((s) => ({
      edges: s.edges.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    })),

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

  addEdge: (from, to, kind, volumePerMonth, extra) => {
    const id = newId("edge");
    set((s) => ({ edges: [...s.edges, { id, from, to, kind, volumePerMonth, ...(extra ?? {}) }] }));
    return id;
  },

  setEdgeStyle: (id, patch) =>
    set((s) => ({
      edges: s.edges.map((e) => {
        if (e.id !== id) return e;
        const next: EdgeStyle = { ...(e.style ?? {}), ...patch };
        for (const k of Object.keys(next) as (keyof EdgeStyle)[]) if (next[k] === undefined) delete next[k];
        const { style: _drop, ...rest } = e;
        void _drop;
        return Object.keys(next).length ? { ...rest, style: next } : rest;
      }),
    })),

  setEdgeAnchors: (id, anchors) =>
    set((s) => ({
      edges: s.edges.map((e) => {
        if (e.id !== id) return e;
        const clean = anchors
          ? Object.fromEntries(Object.entries(anchors).filter(([, v]) => v && v !== "auto"))
          : {};
        const { anchors: _drop, ...rest } = e;
        void _drop;
        return Object.keys(clean).length ? { ...rest, anchors: clean } : rest;
      }),
    })),

  setWaypoints: (id, waypoints) =>
    set((s) => ({
      edges: s.edges.map((e) => {
        if (e.id !== id) return e;
        const { waypoints: _drop, ...rest } = e;
        void _drop;
        return waypoints?.length
          ? { ...rest, waypoints: waypoints.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) })) }
          : rest;
      }),
    })),

  removeWaypoint: (id, index) =>
    set((s) => ({
      edges: s.edges.map((e) => {
        if (e.id !== id || !e.waypoints) return e;
        const wp = e.waypoints.filter((_, i) => i !== index);
        const { waypoints: _drop, ...rest } = e;
        void _drop;
        return wp.length ? { ...rest, waypoints: wp } : rest;
      }),
      selectedWaypoint: null,
    })),

  removeEdge: (id) => set((s) => ({ edges: s.edges.filter((e) => e.id !== id) })),

  setTraffic: (traffic) => set((s) => ({ traffic: { ...s.traffic, ...traffic } })),

  setRegion: (region) => {
    if (!PRICING_TABLES[region]) throw new Error(`No pricing for "${region}"`);
    set({ region });
  },

  /** Re-running replaces the sections it made before; user sections survive.
   *  It also says so: a run that arranges a four-node chain finds no column
   *  worth a section, so the ones a previous run left behind go away, and
   *  that used to happen in silence. */
  applyAutoLayout: () =>
    set((s) => {
      // Lay out for the mode you are looking at · icons pitch by the icon
      // and its name, cards by the card. Frames are sized from the hit-box
      // either way, so nothing overlaps in the mode it was laid out for.
      const cards = cardModeOf(s);
      const { positions, frames, sections } = autoLayoutWithSections(s.nodes, s.edges, s.containers, {
        nodeW: NODE_W,
        nodeH: NODE_H,
        drawW: cards ? NODE_W : ICON_DRAW_W,
        drawH: cards ? NODE_H : ICON_DRAW_H,
      });
      const droppedAuto = s.sections.filter((x) => x.id.startsWith("auto-")).length;
      const columns = new Set(Object.values(positions).map((p) => p.x)).size;
      const notice = [
        `Arranged ${s.nodes.length} ${s.nodes.length === 1 ? "resource" : "resources"} in ${columns} ${columns === 1 ? "column" : "columns"} by dependency`,
        cards ? "card spacing" : "icon spacing",
        sections.length
          ? `${sections.length} ${sections.length === 1 ? "section" : "sections"}`
          : droppedAuto
            ? `${droppedAuto} auto ${droppedAuto === 1 ? "section" : "sections"} removed: every column holds one resource`
            : null,
      ]
        .filter(Boolean)
        .join(" · ");
      return {
        notice: { message: notice, tone: "info" as const },
        nodes: s.nodes.map((n) => ({ ...n, position: positions[n.id] ?? n.position })),
        // every frame is re-fitted to what it holds
        containers: s.containers.map((c) => (frames[c.id] ? { ...c, bounds: frames[c.id] } : c)),
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

  setLayer: (layer, on) => {
    const was = cardModeOf(get());
    set((s) => ({ layers: { ...s.layers, [layer]: on } }));
    retidy(get, was);
  },

  /** Reaching card mode re-arranges the drawing for it, whichever way you
   *  got there · K, the View gear, the Cost layer, or zooming past 130%.
   *
   *  The trigger is the **mode changing**, not the keystroke. It was the
   *  keystroke for an hour, on the reasoning that re-arranging under a zoom
   *  gesture moves the canvas while you are reading it · but a card layout
   *  you only get by remembering to press K is not a layout, and zooming in
   *  to read a label is exactly when the crowding shows. Whatever moves is
   *  one ⌘Z away, because history subscribes to the model and a layout is a
   *  model change like any other. */
  setCardsForced: (on) => {
    const was = cardModeOf(get());
    set({ cardsForced: on });
    retidy(get, was);
  },
  setZoom: (zoom) => {
    const was = cardModeOf(get());
    set({ zoom });
    retidy(get, was);
  },
  select: (id) =>
    set((s) => {
      const section = id ? s.sections.find((x) => x.id === id) : undefined;
      return {
        selectedId: id,
        selectedWaypoint: null,
        ...(id ? { selectedEdgeId: null } : {}),
        // selecting a section selects its members, so a drag carries them
        ...(section ? { selectedIds: sectionMembersDeep(s.sections, section.id) } : id ? { selectedIds: [id] } : { selectedIds: [] }),
      };
    }),
  selectedIds: [],
  setSelectedIds: (ids) => set({ selectedIds: ids }),

  /** ⌘A · every object in the drawing, resources and frames alike, so the
   *  next Delete clears it. `selectedId` goes to null: there is no primary
   *  object in "everything", and the Inspector should not claim one. */
  selectAll: () =>
    set((s) => ({
      selectedId: null,
      selectedEdgeId: null,
      selectedWaypoint: null,
      selectedIds: [
        ...s.nodes.map((n) => n.id),
        ...s.containers.map((c) => c.id),
        ...s.sections.map((x) => x.id),
      ],
    })),

  /** Delete · the whole selection, whatever it is made of, in one step.
   *  Deleting used to read `selectedId` alone, so a marquee over five nodes
   *  removed one of them. The selection is `selectedIds` plus the primary
   *  object, and one `set` keeps it one undo. Removing a frame still only
   *  removes the frame: its contents re-parent upward, exactly as
   *  `removeContainer` does, because nothing inside it was selected. */
  removeSelection: () =>
    set((s) => {
      const ids = new Set(s.selectedIds);
      if (s.selectedId) ids.add(s.selectedId);
      if (!ids.size && !s.selectedEdgeId) return {};
      const { nodes, edges, containers, sections } = removeObjects(snapshotOf(s), {
        ids,
        edgeId: s.selectedEdgeId,
      });
      return {
        nodes,
        edges,
        containers,
        sections,
        selectedId: null,
        selectedEdgeId: null,
        selectedWaypoint: null,
        selectedIds: [],
      };
    }),
  setNodeCard: (id, patch) =>
    set((s) => ({
      nodes: s.nodes.map((n) => {
        if (n.id !== id) return n;
        const { card: _drop, ...rest } = n;
        void _drop;
        if (!patch) return rest;
        const next = { ...(n.card ?? {}), ...patch };
        for (const k of Object.keys(next) as (keyof typeof next)[]) if (next[k] === undefined) delete next[k];
        return Object.keys(next).length ? { ...rest, card: next } : rest;
      }),
    })),
  cardShow: { ...DEFAULT_CARD_SHOW },
  setCardShow: (patch) => set((s) => ({ cardShow: { ...s.cardShow, ...patch } })),
  costDisplay: { ...DEFAULT_COST_DISPLAY },
  setCostDisplay: (patch) => set((s) => ({ costDisplay: { ...s.costDisplay, ...patch } })),
  popover: null,
  setPopover: (p) => set({ popover: p }),
  selectEdge: (id) => set({ selectedEdgeId: id, selectedWaypoint: null, ...(id ? { selectedId: null } : {}) }),
  selectedWaypoint: null,
  setSelectedWaypoint: (i) => set({ selectedWaypoint: i }),
  labelEditingEdgeId: null,
  setLabelEditing: (id) => set({ labelEditingEdgeId: id }),
  connecting: false,
  setConnecting: (on) => set({ connecting: on }),
  pendingConnection: null,
  setPendingConnection: (p) => set({ pendingConnection: p }),
  hover: (id) => set({ hoveredId: id }),
  setTrace: (ids) => set({ traceIds: ids }),
  setExportPanel: (format) => set({ exportPanel: format }),
  setImportPanel: (panel) => set({ importPanel: panel }),
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
    const id = newId(kind);
    // An empty container has nothing to derive a frame from, so it gets a
    // starting rectangle — otherwise "Add AWS Cloud" appears to do nothing.
    const opts = { nodeW: NODE_W, nodeH: NODE_H };
    const boxes = frameBoxes(s.nodes, s.containers, opts);
    const parentBox = parentC ? boxes.get(parentC.id) ?? null : null;
    const occupied = [
      ...s.containers.filter((c) => !c.parent).map((c) => boxes.get(c.id)).filter((b): b is NonNullable<typeof b> => !!b),
      ...s.nodes.map((n) => ({
        l: n.position.x - NODE_W / 2,
        t: n.position.y - NODE_H / 2,
        r: n.position.x + NODE_W / 2,
        b: n.position.y + NODE_H / 2,
      })),
    ];
    const siblings = s.containers
      .filter((c) => c.parent === parentC?.id && parentC)
      .map((c) => boxes.get(c.id))
      .filter((b): b is NonNullable<typeof b> => !!b);
    const bounds = placeNewFrame(kind, parentBox, occupied, siblings);
    set((st) => ({
      containers: [
        ...st.containers,
        { id, kind, name, cidr, parent, collapsed: false, bounds },
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

  // Position is a lock, not a resize: members, child frames and stored
  // bounds all move by the same delta. A derived frame simply follows its
  // members, so auto-grow/shrink stays the default after a move.
  moveContainer: (containerId, dx, dy) =>
    set((s) =>
      s.containers.some((c) => c.id === containerId)
        ? translateFrame({ nodes: s.nodes, containers: s.containers, sections: s.sections }, { kind: "container", id: containerId }, dx, dy)
        : {},
    ),

  setContainerParent: (containerId, parentId) => {
    const s = get();
    if (!s.containers.some((c) => c.id === containerId))
      return { error: { code: "no_such_container" as const, message: `No container "${containerId}".` } };
    if (parentId && !s.containers.some((c) => c.id === parentId))
      return { error: { code: "no_such_container" as const, message: `No container "${parentId}".` } };
    if (wouldCycle(s.containers, containerId, parentId))
      return { error: { code: "would_cycle" as const, message: "A frame cannot sit inside itself." } };
    set((st) => ({
      containers: st.containers.map((c) => {
        if (c.id !== containerId) return c;
        const { parent: _drop, ...rest } = c;
        void _drop;
        return parentId ? { ...rest, parent: parentId } : rest;
      }),
    }));
    return { ok: true as const };
  },

  placeNodeBeside: (id, targetId, where) =>
    set((s) => {
      const node = s.nodes.find((n) => n.id === id);
      if (!node || !s.nodes.some((n) => n.id === targetId) || id === targetId) return {};
      const rest = s.nodes.filter((n) => n.id !== id);
      const i = rest.findIndex((n) => n.id === targetId);
      const at = where === "after" ? i + 1 : i;
      return { nodes: [...rest.slice(0, at), node, ...rest.slice(at)] };
    }),

  setContainerBounds: (containerId, bounds) =>
    set((s) => {
      const floor =
        contentBoxes(s.nodes, s.containers, { nodeW: NODE_W, nodeH: NODE_H }).get(containerId) ?? null;
      return {
        containers: s.containers.map((c) =>
          c.id === containerId
            ? { ...c, bounds: bounds ? clampBounds(bounds, floor) : undefined }
            : c,
        ),
      };
    }),

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
        selectedId: s.selectedId === containerId ? null : s.selectedId,
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
          // a member-less section must still be visible and draggable
          bounds: bounds ?? (nodeIds?.length ? undefined : { x: 40, y: 40, w: 280, h: 160 }),
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
    set((s) => ({
      sections: s.sections.filter((x) => x.id !== id).map((x) => (x.parentId === id ? { ...x, parentId: undefined } : x)),
      selectedId: s.selectedId === id ? null : s.selectedId,
    })),

  setSectionBounds: (id, bounds) =>
    set((s) => ({
      sections: s.sections.map((x) => {
        if (x.id !== id) return x;
        const floor = sectionContentBox(s.nodes, x, { nodeW: NODE_W, nodeH: NODE_H });
        return { ...x, bounds: bounds ? clampBounds(bounds, floor) : undefined };
      }),
    })),

  setSectionCollapsed: (id, collapsed) =>
    set((s) => ({ sections: s.sections.map((x) => (x.id === id ? { ...x, collapsed } : x)) })),

  setSectionColor: (id, color) =>
    set((s) => ({ sections: s.sections.map((x) => (x.id === id ? { ...x, color } : x)) })),

  setSectionStyle: (id, patch) =>
    set((s) => ({
      sections: s.sections.map((x) => {
        if (x.id !== id) return x;
        const next: SectionStyle = { ...(x.style ?? {}), ...patch };
        for (const k of Object.keys(next) as (keyof SectionStyle)[]) if (next[k] === undefined) delete next[k];
        const { style: _drop, ...rest } = x;
        void _drop;
        return Object.keys(next).length ? { ...rest, style: next } : rest;
      }),
    })),

  setSectionParent: (id, parentId) =>
    set((s) => ({
      sections: s.sections.map((x) => {
        if (x.id !== id) return x;
        const { parentId: _drop, ...rest } = x;
        void _drop;
        return parentId && parentId !== id ? { ...rest, parentId } : rest;
      }),
    })),

  addGroup: (nodeIds, name) => {
    const ids = nodeIds.filter((id) => get().nodes.some((n) => n.id === id));
    if (!ids.length) return null;
    const id = newId("group");
    set((s) => ({
      sections: [
        ...s.sections,
        {
          id,
          name: name ?? `Group ${s.sections.filter((x) => x.kind === "group").length + 1}`,
          color: SECTION_COLORS[s.sections.length % SECTION_COLORS.length],
          kind: "group",
          nodeIds: ids,
          collapsed: false,
        },
      ],
      selectedId: id,
      selectedIds: ids,
    }));
    return id;
  },

  ungroup: (id) =>
    set((s) => ({
      sections: s.sections.filter((x) => x.id !== id).map((x) => (x.parentId === id ? { ...x, parentId: undefined } : x)),
      selectedId: s.selectedId === id ? null : s.selectedId,
    })),

  /** One action so undo captures the frame, its members (through nested
   *  sections) and every section riding along as a single step. */
  moveSection: (id, dx, dy) =>
    set((s) =>
      s.sections.some((x) => x.id === id)
        ? translateFrame({ nodes: s.nodes, containers: s.containers, sections: s.sections }, { kind: "section", id }, dx, dy)
        : {},
    ),

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

  renameScenario: (name) =>
    set((s) => (s.scenario ? { scenario: { ...s.scenario, name } } : {})),

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

/** Does this drawing price anything?
 *
 *  A flowchart does not · every one of its shapes is unpriced by definition
 *  (`services/flow.ts`), so a monthly total, a price-list pill and a pricing
 *  region are three pieces of chrome about money on a drawing that has none.
 *  An **empty** canvas still counts as priced: that is where an AWS drawing
 *  starts, and hiding the price list before the first node would read as a
 *  missing feature rather than an honest zero. */
export function pricedOf(s: OverheadState): boolean {
  return (
    !s.nodes.length ||
    s.nodes.some((n) => (getService(n.service)?.family ?? "aws") === "aws")
  );
}

/** Card mode when zoomed past 125%, forced, or the cost layer is on. */
export function cardModeOf(s: OverheadState): boolean {
  return s.cardsForced || s.zoom >= 1.3 || s.layers.cost;
}
