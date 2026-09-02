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
import { useStore, cardModeOf, type Layer } from "@/store/useStore";
import { arrowModeOf, type EdgeKind, type Side } from "@/engine/model";
import { pickSides, shapeAt, type Side4 } from "./edgeGeometry";
import { AwsNode, NODE_W, NODE_H } from "./AwsNode";
import { ContainerCard, CARD_W, CARD_H } from "./ContainerCard";
import { TypedEdge } from "./TypedEdge";
import { ContainerFrames } from "./ContainerFrames";
import { SectionFrames } from "./SectionFrames";
import {
  descendantIds,
  outermostCollapsedAncestor,
  validateNodePlacement,
} from "@/engine/containers";
import { frameBoxes, hitContainer } from "@/engine/frames";

const nodeTypes: NodeTypes = { aws: AwsNode, container: ContainerCard };
const edgeTypes: EdgeTypes = { typed: TypedEdge };

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
  const selectedId = useStore((s) => s.selectedId);
  const selectedIds = useStore((s) => s.selectedIds);
  const setSelectedIds = useStore((s) => s.setSelectedIds);
  const wrapper = useRef<HTMLDivElement>(null);
  const [marquee, setMarquee] = useState(false);

  const litIds = useMemo(() => {
    if (traceIds?.length) return new Set(traceIds);
    if (!hoveredId) return null;
    const lit = new Set<string>([hoveredId]);
    for (const e of edges) {
      if (e.from === hoveredId) lit.add(e.to);
      if (e.to === hoveredId) lit.add(e.from);
    }
    return lit;
  }, [hoveredId, edges, traceIds]);

  const containers = useStore((s) => s.containers);
  const frameDrag = useStore((s) => s.frameDrag);
  const setDragging = useStore((s) => s.setDragging);
  const moveIntoContainer = useStore((s) => s.moveIntoContainer);
  const notify = useStore((s) => s.notify);

  // Collapsed containers: members hide, one card appears at their centroid,
  // edges re-route to it, and edges wholly inside it are dropped.
  const collapsedByNode = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of nodes) {
      const host = outermostCollapsedAncestor(containers, n.container);
      if (host) map.set(n.id, host);
    }
    return map;
  }, [containers, nodes]);

  // A container frame mid-drag carries its members visually; the store
  // moves them once, on release, so undo sees a single step.
  const sections = useStore((s) => s.sections);
  const frameDragMembers = useMemo(() => {
    if (!frameDrag) return null;
    if (frameDrag.kind === "section") {
      return new Set(sections.find((x) => x.id === frameDrag.id)?.nodeIds ?? []);
    }
    const ids = new Set([frameDrag.id, ...descendantIds(containers, frameDrag.id)]);
    return new Set(nodes.filter((n) => n.container && ids.has(n.container)).map((n) => n.id));
  }, [frameDrag, containers, nodes, sections]);

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
          className: litIds?.has(n.id) ? "lit" : undefined,
          // The hit-box is constant by design (nodeMetrics). Passing it as
          // `measured` keeps React Flow's drag maths initialised even though we
          // never apply its dimension changes (controlled nodes, no
          // onNodesChange) — otherwise every drag frame logs error #015.
          width: NODE_W,
          height: NODE_H,
          measured: { width: NODE_W, height: NODE_H },
        };
      });
    const hosts = new Set(collapsedByNode.values());
    for (const id of hosts) {
      const members = nodes.filter((n) => collapsedByNode.get(n.id) === id);
      if (!members.length) continue;
      const cx = members.reduce((a, n) => a + n.position.x, 0) / members.length;
      const cy = members.reduce((a, n) => a + n.position.y, 0) / members.length;
      visible.push({
        id: `container:${id}`,
        type: "container",
        position: { x: cx - CARD_W / 2, y: cy - CARD_H / 2 },
        data: { containerId: id },
        draggable: false,
        width: CARD_W,
        height: CARD_H,
        measured: { width: CARD_W, height: CARD_H },
      });
    }
    return visible;
  }, [nodes, collapsedByNode, litIds, frameDrag, frameDragMembers, selectedId, selectedIds]);

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
      const from = collapsedByNode.has(e.from)
        ? `container:${collapsedByNode.get(e.from)}`
        : e.from;
      const to = collapsedByNode.has(e.to)
        ? `container:${collapsedByNode.get(e.to)}`
        : e.to;
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
    const outs = new Map<string, string[]>();
    const ins = new Map<string, string[]>();
    for (const { e, from, to } of resolved) {
      if (!layers[KIND_LAYER[e.kind]]) continue;
      const sd = sidesOf.get(e.id);
      const ko = `${from}:${sd?.from ?? "right"}`;
      const ki = `${to}:${sd?.to ?? "left"}`;
      outs.set(ko, [...(outs.get(ko) ?? []), e.id]);
      ins.set(ki, [...(ins.get(ki) ?? []), e.id]);
    }
    const out: Edge[] = [];
    for (const { e, from, to, rerouted } of resolved) {
      const sd = sidesOf.get(e.id);
      const sList = outs.get(`${from}:${sd?.from ?? "right"}`) ?? [e.id];
      const tList = ins.get(`${to}:${sd?.to ?? "left"}`) ?? [e.id];
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
        className:
          litIds &&
          (traceIds?.length
            ? litIds.has(e.from) && litIds.has(e.to)
            : e.from === hoveredId || e.to === hoveredId)
            ? "lit"
            : undefined,
        markerEnd: arrow === "end" || arrow === "both" ? marker : undefined,
        markerStart: arrow === "start" || arrow === "both" ? { ...marker, orient: "auto-start-reverse" } : undefined,
      });
    }
    return out;
  }, [edges, layers, litIds, hoveredId, traceIds, collapsedByNode, selectedEdgeId, rfNodes, nodes, cardMode]);

  const onMove = useCallback(
    (_evt: unknown, viewport: { zoom: number }) => setZoom(viewport.zoom),
    [setZoom],
  );

  const { screenToFlowPosition, fitView, getInternalNode } = useReactFlow();
  const addNode = useStore((s) => s.addNode);

  // The seed lands after mount, so the built-in fitView fires too early —
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
        fitView({ maxZoom: 1, padding: 0.15 }).then((applied) => {
          if (!cancelled && applied) didFit.current = true;
        });
        return;
      }
      if (++tries < 60) requestAnimationFrame(attempt);
    };
    requestAnimationFrame(attempt);
    return () => {
      cancelled = true;
    };
  }, [nodes, fitView, getInternalNode]);

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

  // Drag a node across a frame boundary and it re-parents on drop — the
  // same validation move_into_container gives the agent; an illegal drop
  // snaps back and says why.
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const onNodeDragStart = useCallback(
    (_e: unknown, n: Node) => {
      if (n.id.startsWith("container:")) return;
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
        if (d.id.startsWith("container:")) continue;
        moveNode(d.id, d.position.x + NODE_W / 2, d.position.y + NODE_H / 2);
      }
      setDragging(null);
      // re-parenting applies to a lone drag; a multi-drag keeps its frames
      if (dragged && dragged.length > 1) return;
      if (n.id.startsWith("container:")) return;
      const st = useStore.getState();
      const node = st.nodes.find((x) => x.id === n.id);
      if (!node) return;
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
      const err = validateNodePlacement(node.service, hit?.kind ?? null);
      if (err) {
        if (dragStart.current) moveNode(n.id, dragStart.current.x, dragStart.current.y);
        notify(err.message, "warn");
        return;
      }
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
      className={`overhead-canvas ${hoveredId || traceIds?.length ? "hovering" : ""} ${cardMode ? "cards" : ""} ${tool === "connect" || connecting ? "connecting" : ""} ${marquee ? "marquee" : ""}`}
    >
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={(_e, _n, dragged) => {
          for (const n of dragged) {
            if (n.id.startsWith("container:")) continue;
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
          setSelectedIds([...next].filter((id) => !id.startsWith("container:")));
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
          if ((e.shiftKey || e.metaKey || e.ctrlKey) && !n.id.startsWith("container:")) {
            const st = useStore.getState();
            const ids = new Set(st.selectedIds);
            if (st.selectedId && st.nodes.some((x) => x.id === st.selectedId)) ids.add(st.selectedId);
            ids.add(n.id);
            useStore.setState({ selectedId: n.id, selectedEdgeId: null, selectedIds: [...ids] });
            return;
          }
          if (tool === "trace" && !n.id.startsWith("container:")) {
            const st = useStore.getState();
            const visited = new Set<string>([n.id]);
            const queue = [n.id];
            while (queue.length) {
              const cur = queue.shift()!;
              for (const e of st.edges) {
                if (e.from === cur && !visited.has(e.to)) {
                  visited.add(e.to);
                  queue.push(e.to);
                }
              }
            }
            st.setTrace([...visited]);
            return;
          }
          select(n.id);
        }}
        onEdgeClick={(e, edge) => {
          e.stopPropagation();
          selectEdge(edge.id);
        }}
        onPaneClick={() => {
          select(null);
          selectEdge(null);
          useStore.getState().setTrace(null);
        }}
        onConnect={(c) => {
          if (!c.source || !c.target) return;
          const from = sideOf(c.sourceHandle);
          const to = sideOf(c.targetHandle);
          storeAddEdge(c.source, c.target, "sync", undefined, from || to ? { anchors: { ...(from ? { from } : {}), ...(to ? { to } : {}) } } : undefined);
        }}
        onConnectStart={() => setConnecting(true)}
        onConnectEnd={(evt, state) => {
          setConnecting(false);
          if (state.isValid || !state.fromNode || state.fromNode.id.startsWith("container:")) return;
          const client = "clientX" in evt ? { x: evt.clientX, y: evt.clientY } : { x: evt.changedTouches[0].clientX, y: evt.changedTouches[0].clientY };
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
          !c.source.startsWith("container:") &&
          !c.target.startsWith("container:") &&
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
        onSelectionStart={() => setMarquee(true)}
        onSelectionEnd={() => setMarquee(false)}
        nodeDragThreshold={4}
        nodesDraggable={tool !== "pan"}
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
        <ContainerFrames />
        <SectionFrames />
      </ReactFlow>
    </div>
  );
}
