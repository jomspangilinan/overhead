"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  ConnectionMode,
  MarkerType,
  useReactFlow,
  type Node,
  type Edge,
  type NodeTypes,
  type EdgeTypes,
} from "@xyflow/react";
import { useStore, cardModeOf, pricingOf, snapshotOf, type Layer } from "@/store/useStore";
import { computeDelta } from "@/engine/delta";
import { arrowModeOf, type EdgeKind, type Side } from "@/engine/model";
import { fanSlots, pickSides, shapeAt, type Side4 } from "./edgeGeometry";
import { AwsNode, NODE_W, NODE_H } from "./AwsNode";
import { FrameCard, CARD_W, CARD_H } from "./FrameCard";
import { TypedEdge } from "./TypedEdge";
import { ContainerFrames } from "./ContainerFrames";
import { SectionFrames } from "./SectionFrames";
import { outermostCollapsedAncestor } from "@/engine/containers";
import { frameBoxes, framesAt, hitContainer, movedNodeIds, sectionBoxes, sectionsAfterDrop } from "@/engine/frames";
import { traceFrom } from "@/engine/trace";
import { TracePulse } from "./TracePulse";
import { LitProvider } from "./isolation";
import { useFitDrawing } from "./fitDrawing";
import { PeerCursors } from "./PeerCursors";
import { sendCursor } from "@/net/room";

const nodeTypes: NodeTypes = { aws: AwsNode, frame: FrameCard };
const edgeTypes: EdgeTypes = { typed: TypedEdge };

/** React Flow ids for the collapsed-frame cards · `container:<id>` / `section:<id>`. */
const isFrameCard = (id: string) => id.startsWith("container:") || id.startsWith("section:");
const frameIdOf = (id: string) => id.slice(id.indexOf(":") + 1);

const sideOf = (handle: string | null | undefined): Exclude<Side, "auto"> | undefined =>
  handle === "left" || handle === "right" || handle === "top" || handle === "bottom" ? handle : undefined;

const KIND_LAYER: Record<EdgeKind, Layer> = {
  sync: "request",
  async: "events",
  data: "data",
};

export function Canvas() {
  const nodes = useStore((s) => s.nodes);
  const edges = useStore((s) => s.edges);
  const layers = useStore((s) => s.layers);
  const hoveredId = useStore((s) => s.hoveredId);
  const moveNode = useStore((s) => s.moveNode);
  const select = useStore((s) => s.select);
  const hover = useStore((s) => s.hover);
  const setZoom = useStore((s) => s.setZoom);
  const cardMode = useStore(cardModeOf);

  const traceIds = useStore((s) => s.traceIds);
  const tracePlay = useStore((s) => s.tracePlay);
  const traceBranch = useStore((s) => s.traceBranch);
  const scenario = useStore((s) => s.scenario);
  const traffic = useStore((s) => s.traffic);
  const region = useStore((s) => s.region);
  const tool = useStore((s) => s.tool);
  const gridOn = useStore((s) => s.gridOn);
  const selectedEdgeId = useStore((s) => s.selectedEdgeId);
  const selectEdge = useStore((s) => s.selectEdge);
  const storeAddEdge = useStore((s) => s.addEdge);
  const connecting = useStore((s) => s.connecting);
  const setConnecting = useStore((s) => s.setConnecting);
  const setPendingConnection = useStore((s) => s.setPendingConnection);
  const setPalette = useStore((s) => s.setPalette);
  const setLabelEditing = useStore((s) => s.setLabelEditing);
  const { screenToFlowPosition, getInternalNode } = useReactFlow();
  /** Where the last pane click landed and how deep into the frame stack it
   *  had walked · clicking the same spot again goes one further out. */
  const cycle = useRef<{ x: number; y: number; i: number } | null>(null);
  /** Where a press on the empty canvas began · a click that moved is a drag. */
  const pressed = useRef<{ x: number; y: number } | null>(null);
  const selectedId = useStore((s) => s.selectedId);
  const selectedIds = useStore((s) => s.selectedIds);
  const setSelectedIds = useStore((s) => s.setSelectedIds);
  const wrapper = useRef<HTMLDivElement>(null);
  const [marquee, setMarquee] = useState(false);
  // Section tool: drag a rectangle on the pane; on release it becomes a
  // section over that area with the resources inside as members.
  const [draw, setDraw] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const drawRef = useRef<{ x0: number; y0: number } | null>(null);
  const addSection = useStore((s) => s.addSection);
  const setTool = useStore((s) => s.setTool);
  const canvasPoint = (e: React.PointerEvent) => {
    const r = wrapper.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  };
  const onDrawDown = (e: React.PointerEvent) => {
    if (tool !== "section" || !(e.target as HTMLElement).classList?.contains("react-flow__pane")) return;
    e.stopPropagation();
    e.preventDefault();
    const p = canvasPoint(e);
    drawRef.current = { x0: p.x, y0: p.y };
    setDraw({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
    wrapper.current?.setPointerCapture(e.pointerId);
  };
  const onDrawMove = (e: React.PointerEvent) => {
    if (!drawRef.current) return;
    const p = canvasPoint(e);
    setDraw({ ...drawRef.current, x1: p.x, y1: p.y });
  };
  const onDrawUp = (e: React.PointerEvent) => {
    const d = drawRef.current;
    if (!d) return;
    drawRef.current = null;
    setDraw(null);
    const p = canvasPoint(e);
    const r = wrapper.current?.getBoundingClientRect();
    const a = screenToFlowPosition({ x: Math.min(d.x0, p.x) + (r?.left ?? 0), y: Math.min(d.y0, p.y) + (r?.top ?? 0) });
    const b = screenToFlowPosition({ x: Math.max(d.x0, p.x) + (r?.left ?? 0), y: Math.max(d.y0, p.y) + (r?.top ?? 0) });
    const w = b.x - a.x;
    const h = b.y - a.y;
    if (w < 40 || h < 30) {
      notify("Drag out a rectangle to make a section", "info");
      return;
    }
    const st = useStore.getState();
    const members = st.nodes.filter((n) => n.position.x >= a.x && n.position.x <= b.x && n.position.y >= a.y && n.position.y <= b.y).map((n) => n.id);
    const count = st.sections.filter((x) => x.kind !== "group").length + 1;
    const id = addSection(`Section ${count}`, members, undefined, { x: Math.round(a.x), y: Math.round(a.y), w: Math.round(w), h: Math.round(h) });
    select(id);
    setTool("select");
    notify(members.length ? `Section ${count} · ${members.length} resource${members.length === 1 ? "" : "s"}` : `Section ${count} added · drag resources in`);
  };

  const containers = useStore((s) => s.containers);
  const frameDrag = useStore((s) => s.frameDrag);
  const setDragging = useStore((s) => s.setDragging);
  const moveIntoContainer = useStore((s) => s.moveIntoContainer);
  const notify = useStore((s) => s.notify);

  const sections = useStore((s) => s.sections);

  // Collapsed frames: members hide, one card appears at their centroid (or
  // at the frame's own rectangle when it holds nothing), edges re-route to
  // it, and edges wholly inside it are dropped. A collapsed container wins
  // over a collapsed section holding the same node.
  const collapsedByNode = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of nodes) {
      const host = outermostCollapsedAncestor(containers, n.container);
      if (host) {
        map.set(n.id, `container:${host}`);
        continue;
      }
      const sec = sections.find((s) => s.collapsed && s.kind !== "group" && s.nodeIds.includes(n.id));
      if (sec) map.set(n.id, `section:${sec.id}`);
    }
    return map;
  }, [containers, nodes, sections]);

  // Hover isolation works on the graph *as drawn*: hovering a collapsed
  // frame's card stands in for every member inside it, so its edges light
  // and it never dims itself · `litIds` is in model ids, `litKeys` the
  // same set mapped onto what is actually rendered (a member's card).
  /** What the pointer is on, in model ids: a resource, or every member of
   *  a collapsed frame's card. */
  const hoverSeeds = useMemo(() => {
    if (!hoveredId) return null;
    if (!isFrameCard(hoveredId)) return new Set([hoveredId]);
    const out = new Set<string>();
    for (const [nodeId, host] of collapsedByNode) if (host === hoveredId) out.add(nodeId);
    return out;
  }, [hoveredId, collapsedByNode]);

  /** The routes of the current trace · the pulse walks these and, in branch
   *  mode, they are also what lights. Recomputed here rather than stored:
   *  it is a pure function of the edges and the origin (`engine/trace.ts`). */
  const traceRoutes = useMemo(
    () => (traceIds?.length ? traceFrom(edges, traceIds[0]).branches : []),
    [traceIds, edges],
  );
  /** The edge ids lit right now · one route in branch mode, all of them in
   *  "all". Null when nothing is traced. */
  const tracedEdgeIds = useMemo(() => {
    if (!traceIds?.length) return null;
    if (tracePlay === "all" || !traceRoutes.length) return null;
    return new Set(traceRoutes[(traceBranch ?? 0) % traceRoutes.length]);
  }, [traceIds, tracePlay, traceRoutes, traceBranch]);

  const litIds = useMemo(() => {
    if (tracedEdgeIds) {
      // Only what this route touches · the origin plus both ends of each of
      // its connections, so a fan-out reads one arm at a time.
      const lit = new Set<string>([traceIds![0]]);
      for (const e of edges) {
        if (!tracedEdgeIds.has(e.id)) continue;
        lit.add(e.from);
        lit.add(e.to);
      }
      return lit;
    }
    if (traceIds?.length) return new Set(traceIds);
    if (!hoverSeeds) return null;
    const seeds = hoverSeeds;
    const lit = new Set<string>(seeds);
    for (const e of edges) {
      if (seeds.has(e.from)) lit.add(e.to);
      if (seeds.has(e.to)) lit.add(e.from);
    }
    return lit;
  }, [hoverSeeds, edges, traceIds, tracedEdgeIds]);

  const litKeys = useMemo(() => {
    if (!litIds) return null;
    const out = new Set<string>();
    for (const id of litIds) out.add(collapsedByNode.get(id) ?? id);
    if (hoveredId && isFrameCard(hoveredId)) out.add(hoveredId);
    return out;
  }, [litIds, collapsedByNode, hoveredId]);

  // A container frame mid-drag carries its members visually; the store
  // moves them once, on release, so undo sees a single step.
  const frameDragMembers = useMemo(
    () => (frameDrag ? movedNodeIds({ nodes, containers, sections }, frameDrag) : null),
    [frameDrag, containers, nodes, sections],
  );

  // While a scenario is open, the resources the fork touched wear a ring ·
  // the delta belongs on the drawing, not only in the banner.
  const scenarioChanged = useMemo(() => {
    const s = useStore.getState();
    if (!s.scenario) return null;
    try {
      return new Set(computeDelta(s.scenario.base, snapshotOf(s), pricingOf(s)).nodes.map((n) => n.id));
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario, nodes, edges, traffic, region]);

  const rfNodes: Node[] = useMemo(() => {
    const visible: Node[] = nodes
      .filter((n) => !collapsedByNode.has(n.id))
      .map((n) => {
        const carried = frameDrag && frameDragMembers?.has(n.id);
        return {
          id: n.id,
          type: "aws",
          position: {
            x: n.position.x - NODE_W / 2 + (carried ? frameDrag.dx : 0),
            y: n.position.y - NODE_H / 2 + (carried ? frameDrag.dy : 0),
          },
          data: { nodeId: n.id },
          selected: n.id === selectedId || selectedIds.includes(n.id),
          className: [litKeys?.has(n.id) ? "lit" : "", scenarioChanged?.has(n.id) ? "forked" : ""].filter(Boolean).join(" ") || undefined,
          // The hit-box is constant by design (nodeMetrics). Passing it as
          // `measured` keeps React Flow's drag maths initialised even though we
          // never apply its dimension changes (controlled nodes, no
          // onNodesChange) · otherwise every drag frame logs error #015.
          width: NODE_W,
          height: NODE_H,
          measured: { width: NODE_W, height: NODE_H },
        };
      });
    // One card per collapsed frame, including a frame holding nothing (it
    // sits where its own rectangle is · collapsing an empty VPC must not
    // make it vanish). A frame inside an already-collapsed one draws none.
    const card = (key: string, kind: "container" | "section", id: string, bounds: { x: number; y: number; w: number; h: number } | undefined) => {
      const members = nodes.filter((n) => collapsedByNode.get(n.id) === key);
      const centre = members.length
        ? {
            x: members.reduce((a, n) => a + n.position.x, 0) / members.length,
            y: members.reduce((a, n) => a + n.position.y, 0) / members.length,
          }
        : bounds
          ? { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 }
          : null;
      if (!centre) return;
      visible.push({
        id: key,
        type: "frame",
        position: { x: centre.x - CARD_W / 2, y: centre.y - CARD_H / 2 },
        data: { frameKind: kind, frameId: id },
        // A card stands in for its frame, so it is selected when the frame is ·
        // primary or part of the multi-selection (⌘A).
        selected: selectedId === id || selectedIds.includes(id),
        className: `oh-frame-card${litKeys?.has(key) ? " lit" : ""}`,
        draggable: false,
        width: CARD_W,
        height: CARD_H,
        measured: { width: CARD_W, height: CARD_H },
      });
    };
    for (const c of containers) {
      if (!c.collapsed || outermostCollapsedAncestor(containers, c.parent)) continue;
      card(`container:${c.id}`, "container", c.id, c.bounds);
    }
    for (const s of sections) {
      if (!s.collapsed || s.kind === "group") continue;
      card(`section:${s.id}`, "section", s.id, s.bounds);
    }
    return visible;
  }, [nodes, containers, sections, collapsedByNode, litKeys, scenarioChanged, frameDrag, frameDragMembers, selectedId, selectedIds]);

  const rfEdges: Edge[] = useMemo(() => {
    // Shapes as currently drawn (carried frame offsets included) so the
    // sides are picked from the same geometry the edge component sees.
    const shapes = new Map<string, ReturnType<typeof shapeAt>>();
    for (const n of rfNodes) {
      const w = n.width ?? NODE_W;
      const h = n.height ?? NODE_H;
      shapes.set(n.id, shapeAt({ x: n.position.x + w / 2, y: n.position.y + h / 2 }, w, h, cardMode || n.type === "container"));
    }
    const graphCx = nodes.length ? nodes.reduce((a, n) => a + n.position.x, 0) / nodes.length : 0;
    const seen = new Set<string>();
    // First pass: resolve endpoints (collapsed hosts) and drop duplicates.
    const resolved: { e: (typeof edges)[number]; from: string; to: string; rerouted: boolean }[] = [];
    for (const e of edges) {
      const from = collapsedByNode.get(e.from) ?? e.from;
      const to = collapsedByNode.get(e.to) ?? e.to;
      const rerouted = from !== e.from || to !== e.to;
      // a genuine self-loop draws; a loop created by collapsing is dropped
      if (from === to && rerouted) continue;
      const key = `${from}>${to}`;
      if (rerouted) {
        if (seen.has(key)) continue;
        seen.add(key);
      }
      resolved.push({ e, from, to, rerouted });
    }
    // Fan slots: which of the edges leaving `from` / entering `to` is this one.
    // Hidden layers are excluded so a toggle doesn't leave gaps in the fan.
    // Sides are picked here, once per edge, so the fan is keyed per side.
    const sidesOf = new Map<string, { from: Side4; to: Side4; caseKind: ReturnType<typeof pickSides>["caseKind"] }>();
    for (const { e, from, to, rerouted } of resolved) {
      const s = shapes.get(from);
      const t = shapes.get(to);
      if (!s || !t) continue;
      const outwardK = (s.cx + t.cx) / 2 >= graphCx ? (1 as const) : (-1 as const);
      sidesOf.set(e.id, pickSides(s, t, { from: rerouted ? undefined : e.anchors?.from, to: rerouted ? undefined : e.anchors?.to, outwardK }));
    }
    // Which edges share a side of a node, and in what order they take its
    // slots · `fanSlots` sorts them by where the other end sits, so a side's
    // slots run the same way the edges do and a fan never crosses itself at
    // the node. Declaration order used to decide it, which is why the two
    // routes out of one resource could leave as a single line.
    const outs = new Map<string, { id: string; other: { cx: number; cy: number } }[]>();
    const ins = new Map<string, { id: string; other: { cx: number; cy: number } }[]>();
    for (const { e, from, to } of resolved) {
      if (!layers[KIND_LAYER[e.kind]]) continue;
      const s = shapes.get(from);
      const t = shapes.get(to);
      if (!s || !t) continue;
      const sd = sidesOf.get(e.id);
      const ko = `${from}:${sd?.from ?? "right"}`;
      const ki = `${to}:${sd?.to ?? "left"}`;
      outs.set(ko, [...(outs.get(ko) ?? []), { id: e.id, other: t }]);
      ins.set(ki, [...(ins.get(ki) ?? []), { id: e.id, other: s }]);
    }
    const ordered = (m: Map<string, { id: string; other: { cx: number; cy: number } }[]>) => {
      const out = new Map<string, string[]>();
      for (const [key, members] of m) {
        const side = key.slice(key.lastIndexOf(":") + 1) as Side4;
        out.set(key, fanSlots(members, side));
      }
      return out;
    };
    const outSlots = ordered(outs);
    const inSlots = ordered(ins);
    const out: Edge[] = [];
    for (const { e, from, to, rerouted } of resolved) {
      const sd = sidesOf.get(e.id);
      const sList = outSlots.get(`${from}:${sd?.from ?? "right"}`) ?? [e.id];
      const tList = inSlots.get(`${to}:${sd?.to ?? "left"}`) ?? [e.id];
      const fan = {
        sIdx: Math.max(0, sList.indexOf(e.id)),
        sCount: sList.length,
        tIdx: Math.max(0, tList.indexOf(e.id)),
        tCount: tList.length,
      };
      const arrow = arrowModeOf(e);
      const marker = {
        type: MarkerType.ArrowClosed,
        width: 14,
        height: 14,
        color: e.id === selectedEdgeId ? "var(--accent)" : "var(--edge)",
      };
      out.push({
        id: e.id,
        type: "typed",
        source: from,
        target: to,
        selected: e.id === selectedEdgeId,
        hidden: !layers[KIND_LAYER[e.kind]],
        data: {
          kind: e.kind,
          volumePerMonth: rerouted ? undefined : e.volumePerMonth,
          label: rerouted ? undefined : e.label,
          style: e.style,
          waypoints: rerouted ? undefined : e.waypoints,
          anchors: rerouted ? undefined : e.anchors,
          sides: sd,
          fan,
        },
        // a traced edge is lit *and* animated · the dashes run the way the
        // request runs, which is what a trace is supposed to show
        className:
          litIds &&
          (traceIds?.length
            ? tracedEdgeIds
              ? tracedEdgeIds.has(e.id)
              : litIds.has(e.from) && litIds.has(e.to)
            : !!hoverSeeds && (hoverSeeds.has(e.from) || hoverSeeds.has(e.to)))
            ? traceIds?.length
              ? "lit traced"
              : "lit"
            : undefined,
        markerEnd: arrow === "end" || arrow === "both" ? marker : undefined,
        markerStart: arrow === "start" || arrow === "both" ? { ...marker, orient: "auto-start-reverse" } : undefined,
      });
    }
    return out;
  }, [edges, layers, litIds, hoverSeeds, traceIds, tracedEdgeIds, collapsedByNode, selectedEdgeId, rfNodes, nodes, cardMode]);

  const onMove = useCallback(
    (_evt: unknown, viewport: { zoom: number }) => setZoom(viewport.zoom),
    [setZoom],
  );

  const addNode = useStore((s) => s.addNode);
  const fitDrawing = useFitDrawing();
  const inRoom = useStore((s) => !!s.room);

  // The seed lands after mount, so the built-in fitView fires too early ·
  // and useNodesInitialized never flips in a controlled flow without
  // onNodesChange. Retry until React Flow's internals have measured every
  // store node, then fit once.
  const didFit = useRef(false);
  useEffect(() => {
    if (!nodes.length) {
      didFit.current = false;
      return;
    }
    if (didFit.current) return;
    let cancelled = false;
    let tries = 0;
    const attempt = () => {
      if (cancelled || didFit.current) return;
      const allMeasured = nodes.every(
        (n) => getInternalNode(n.id)?.measured?.width,
      );
      if (allMeasured) {
        // The whole drawing, frames included · fitView alone clips a frame
        // that reaches past its contents (fitDrawing.ts).
        if (fitDrawing()) didFit.current = true;
        return;
      }
      if (++tries < 60) requestAnimationFrame(attempt);
    };
    requestAnimationFrame(attempt);
    return () => {
      cancelled = true;
    };
  }, [nodes, fitDrawing, getInternalNode]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      const service = e.dataTransfer.getData("application/overhead-service");
      if (!service) return;
      e.preventDefault();
      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const count = useStore.getState().nodes.length;
      const id = addNode(service, `${service}-${count + 1}`, undefined, undefined, pos);
      select(id);
    },
    [screenToFlowPosition, addNode, select],
  );

  // Drag a node across a frame boundary and it re-parents on drop · the
  // same validation move_into_container gives the agent; an illegal drop
  // snaps back and says why.
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const connectFrom = useRef<{ x: number; y: number } | null>(null);
  const onNodeDragStart = useCallback(
    (_e: unknown, n: Node) => {
      if (isFrameCard(n.id)) return;
      const cur = useStore.getState().nodes.find((x) => x.id === n.id);
      dragStart.current = cur ? { ...cur.position } : null;
      setDragging(n.id);
    },
    [setDragging],
  );
  const onNodeDragStop = useCallback(
    (_e: unknown, n: Node, dragged?: Node[]) => {
      const cx = n.position.x + NODE_W / 2;
      const cy = n.position.y + NODE_H / 2;
      for (const d of dragged ?? [n]) {
        if (isFrameCard(d.id)) continue;
        moveNode(d.id, d.position.x + NODE_W / 2, d.position.y + NODE_H / 2);
      }
      setDragging(null);
      // re-parenting applies to a lone drag; a multi-drag keeps its frames
      if (dragged && dragged.length > 1) return;
      if (isFrameCard(n.id)) return;
      const st = useStore.getState();
      const node = st.nodes.find((x) => x.id === n.id);
      if (!node) return;
      // Sections follow the drawing: dropped outside a section's box the
      // node leaves it, dropped inside one it joins.
      for (const ch of sectionsAfterDrop(st.nodes, st.sections, n.id, { nodeW: NODE_W, nodeH: NODE_H })) st.setSectionNodes(ch.id, ch.nodeIds);
      const boxes = frameBoxes(st.nodes, st.containers, { nodeW: NODE_W, nodeH: NODE_H, exclude: n.id });
      // The node's own frame vanished without it (it was the only content):
      // it stays a member unless it landed inside something else.
      const ownGone = !!node.container && !boxes.has(node.container);
      const visible = (c: (typeof st.containers)[number]) =>
        !c.collapsed && !outermostCollapsedAncestor(st.containers, c.id);
      const hit = hitContainer(boxes, st.containers, { x: cx, y: cy }, visible);
      const targetId = hit?.id ?? null;
      if ((targetId ?? undefined) === node.container) return;
      if (ownGone && !hit) return;
      const res = moveIntoContainer([n.id], targetId);
      if ("error" in res) {
        if (dragStart.current) moveNode(n.id, dragStart.current.x, dragStart.current.y);
        notify(res.error.message, "warn");
        return;
      }
      notify(hit ? `${node.name} → ${hit.name}` : `${node.name} → canvas`);
    },
    [moveNode, setDragging, moveIntoContainer, notify],
  );

  return (
    <div
      ref={wrapper}
      className={`overhead-canvas ${hoveredId || traceIds?.length ? "hovering" : ""} ${cardMode ? "cards" : ""} ${tool === "connect" || connecting ? "connecting" : ""} ${marquee ? "marquee" : ""} ${tool === "section" ? "drawing" : ""} ${tool === "trace" ? "tracing" : ""}`}
      onPointerDownCapture={(e) => {
        // Where a press began · a click that travelled is a drag, and the
        // browser fires `click` for it all the same (see onPaneClick).
        pressed.current = { x: e.clientX, y: e.clientY };
        onDrawDown(e);
      }}
      onPointerMove={(e) => {
        onDrawMove(e);
        // In a room, my pointer is worth sending · in canvas coordinates, so
        // it lands on the same resource whatever anybody's zoom is. Outside
        // a room this is a no-op and nothing is connected to send it to.
        if (inRoom) {
          const p = screenToFlowPosition({ x: e.clientX, y: e.clientY });
          sendCursor(p.x, p.y);
        }
      }}
      onPointerUp={onDrawUp}
      onPointerCancel={() => {
        drawRef.current = null;
        setDraw(null);
      }}
    >
      {draw ? (
        <div
          className="oh-draw-rect"
          style={{ left: Math.min(draw.x0, draw.x1), top: Math.min(draw.y0, draw.y1), width: Math.abs(draw.x1 - draw.x0), height: Math.abs(draw.y1 - draw.y0) }}
        />
      ) : null}
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={(_e, _n, dragged) => {
          for (const n of dragged) {
            if (isFrameCard(n.id)) continue;
            moveNode(n.id, n.position.x + NODE_W / 2, n.position.y + NODE_H / 2);
          }
        }}
        // Controlled nodes: only selection changes are applied (marquee,
        // shift-click); positions come through onNodeDrag, dimensions are
        // constant. Keeps a quick click a select and a held drag a move.
        onNodesChange={(changes) => {
          const sel = changes.filter((c) => c.type === "select");
          if (!sel.length) return;
          const next = new Set(useStore.getState().selectedIds);
          for (const c of sel) {
            if (c.type !== "select") continue;
            if (c.selected) next.add(c.id);
            else next.delete(c.id);
          }
          setSelectedIds([...next].filter((id) => !isFrameCard(id)));
        }}
        onNodeDragStop={onNodeDragStop}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("application/overhead-service")) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
          }
        }}
        onDrop={onDrop}
        multiSelectionKeyCode={["Meta", "Shift"]}
        onNodeClick={(e, n) => {
          // ⇧ / ⌘ click adds to the selection (React Flow has already
          // applied its own select change through onNodesChange)
          if ((e.shiftKey || e.metaKey || e.ctrlKey) && !isFrameCard(n.id)) {
            const st = useStore.getState();
            const ids = new Set(st.selectedIds);
            if (st.selectedId && st.nodes.some((x) => x.id === st.selectedId)) ids.add(st.selectedId);
            ids.add(n.id);
            useStore.setState({ selectedId: n.id, selectedEdgeId: null, selectedIds: [...ids] });
            return;
          }
          if (tool === "trace" && !isFrameCard(n.id)) {
            const st = useStore.getState();
            st.setTrace(traceFrom(st.edges, n.id).nodeIds);
            // one click, one trace · the tool disarms so the next click
            // inspects a node again (the pill keeps the trace on screen)
            st.setTool("select");
            return;
          }
          // a collapsed frame's card selects the frame itself, so the
          // Inspector shows it (with Expand) instead of nothing
          select(isFrameCard(n.id) ? frameIdOf(n.id) : n.id);
        }}
        onEdgeClick={(e, edge) => {
          e.stopPropagation();
          selectEdge(edge.id);
        }}
        onPaneClick={(e) => {
          // A marquee ends with a click on the pane, and this handler would
          // then select whatever frame is under the release point · which is
          // to say it threw the marquee's selection away the instant you let
          // go. Only a press that stayed put is a click.
          const from = pressed.current;
          pressed.current = null;
          if (from && Math.hypot(e.clientX - from.x, e.clientY - from.y) > 4) return;
          selectEdge(null);
          useStore.getState().setTrace(null);
          // Blank space *inside* a frame selects that frame · it used to
          // clear the selection, which meant a container could only be
          // selected by its header band, and its resize grip only shows
          // once it is selected. So an empty VPC was a box you could not
          // get hold of.
          //
          // Clicking the same spot again walks outward: section, then the
          // VPC around it, then the region, then nothing, then round again.
          // With three frames over one point there is no other way to reach
          // the middle one.
          const st = useStore.getState();
          const p = screenToFlowPosition({ x: e.clientX, y: e.clientY });
          const opts = { nodeW: NODE_W, nodeH: NODE_H };
          const hidden = collapsedByNode.size ? new Set(collapsedByNode.keys()) : undefined;
          const stack = framesAt(p, [
            ...[...frameBoxes(st.nodes, st.containers, opts)].map(([id, box]) => ({ kind: "container" as const, id, box })),
            ...[...sectionBoxes(st.nodes, st.sections, { ...opts, hidden })].map(([id, box]) => ({ kind: "section" as const, id, box })),
          ]);
          if (!stack.length) {
            cycle.current = null;
            select(null);
            return;
          }
          const near = cycle.current && Math.hypot(p.x - cycle.current.x, p.y - cycle.current.y) < 8;
          const i = near ? cycle.current!.i + 1 : 0;
          // One past the outermost is "nothing selected", so the cycle
          // always offers a way out rather than trapping you in the frames ·
          // and the counter goes back to the start there, so the click after
          // that is the innermost again rather than a second empty one.
          if (i >= stack.length) {
            cycle.current = { x: p.x, y: p.y, i: -1 };
            select(null);
            return;
          }
          cycle.current = { x: p.x, y: p.y, i };
          select(stack[i].id);
        }}
        onConnect={(c) => {
          if (!c.source || !c.target) return;
          const from = sideOf(c.sourceHandle);
          const to = sideOf(c.targetHandle);
          storeAddEdge(c.source, c.target, "sync", undefined, from || to ? { anchors: { ...(from ? { from } : {}), ...(to ? { to } : {}) } } : undefined);
        }}
        onConnectStart={(evt) => {
          connectFrom.current = "clientX" in evt ? { x: evt.clientX, y: evt.clientY } : { x: evt.touches[0].clientX, y: evt.touches[0].clientY };
          setConnecting(true);
        }}
        onConnectEnd={(evt, state) => {
          setConnecting(false);
          if (state.isValid || !state.fromNode || isFrameCard(state.fromNode.id)) return;
          const client = "clientX" in evt ? { x: evt.clientX, y: evt.clientY } : { x: evt.changedTouches[0].clientX, y: evt.changedTouches[0].clientY };
          // With the Connect tool the whole node is a handle, so a plain
          // click (no drag) is a select, not "connect from here".
          const from = connectFrom.current;
          if (from && Math.hypot(client.x - from.x, client.y - from.y) < 6) {
            select(state.fromNode.id);
            return;
          }
          const rect = wrapper.current?.getBoundingClientRect();
          setPendingConnection({
            fromNodeId: state.fromNode.id,
            side: sideOf(state.fromHandle?.id ?? null) ?? "right",
            at: screenToFlowPosition(client),
            screen: { x: client.x - (rect?.left ?? 0), y: client.y - (rect?.top ?? 0) },
          });
          setPalette(true);
        }}
        onEdgeDoubleClick={(e, edge) => {
          e.stopPropagation();
          selectEdge(edge.id);
          setLabelEditing(edge.id);
        }}
        isValidConnection={(c) =>
          !!c.source &&
          !!c.target &&
          !isFrameCard(c.source) &&
          !isFrameCard(c.target) &&
          !useStore
            .getState()
            .edges.some((e) => e.from === c.source && e.to === c.target)
        }
        connectionRadius={90}
        connectionMode={ConnectionMode.Loose}
        deleteKeyCode={null}
        onNodeMouseEnter={(_e, n) => hover(n.id)}
        onNodeMouseLeave={() => hover(null)}
        onMove={onMove}
        fitView
        fitViewOptions={{ maxZoom: 1, padding: 0.15 }}
        minZoom={0.5}
        maxZoom={1.8}
        zoomOnScroll={false}
        panOnDrag={tool === "pan"}
        selectionOnDrag={tool === "select"}
        elementsSelectable={tool !== "section"}
        onSelectionStart={() => setMarquee(true)}
        onSelectionEnd={() => setMarquee(false)}
        nodeDragThreshold={4}
        nodesDraggable={tool !== "pan" && tool !== "connect"}
        zoomOnPinch
        panOnScroll
      >
        {gridOn ? (
          <Background
            variant={BackgroundVariant.Dots}
            gap={26}
            size={1.5}
            color="#2A3441"
          />
        ) : null}
        <LitProvider value={litIds}>
          <ContainerFrames />
          <SectionFrames />
        </LitProvider>
        <TracePulse />
        <PeerCursors />
      </ReactFlow>
    </div>
  );
}
