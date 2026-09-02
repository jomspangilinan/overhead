"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
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
import type { EdgeKind } from "@/engine/model";
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
  }, [nodes, collapsedByNode, litIds, frameDrag, frameDragMembers]);

  const rfEdges: Edge[] = useMemo(() => {
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
      if (from === to) continue;
      const rerouted = from !== e.from || to !== e.to;
      const key = `${from}>${to}`;
      if (rerouted) {
        if (seen.has(key)) continue;
        seen.add(key);
      }
      resolved.push({ e, from, to, rerouted });
    }
    // Fan slots: which of the edges leaving `from` / entering `to` is this one.
    // Hidden layers are excluded so a toggle doesn't leave gaps in the fan.
    const outs = new Map<string, string[]>();
    const ins = new Map<string, string[]>();
    for (const { e, from, to } of resolved) {
      if (!layers[KIND_LAYER[e.kind]]) continue;
      outs.set(from, [...(outs.get(from) ?? []), e.id]);
      ins.set(to, [...(ins.get(to) ?? []), e.id]);
    }
    const out: Edge[] = [];
    for (const { e, from, to, rerouted } of resolved) {
      const sList = outs.get(from) ?? [e.id];
      const tList = ins.get(to) ?? [e.id];
      const fan = {
        sIdx: Math.max(0, sList.indexOf(e.id)),
        sCount: sList.length,
        tIdx: Math.max(0, tList.indexOf(e.id)),
        tCount: tList.length,
      };
      const arrow = e.style?.arrow ?? e.kind !== "data";
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
          route: rerouted ? undefined : e.route,
          fan,
        },
        className:
          litIds &&
          (traceIds?.length
            ? litIds.has(e.from) && litIds.has(e.to)
            : e.from === hoveredId || e.to === hoveredId)
            ? "lit"
            : undefined,
        markerEnd: arrow
          ? {
              type: MarkerType.ArrowClosed,
              width: 14,
              height: 14,
              color: e.id === selectedEdgeId ? "var(--accent)" : "var(--edge)",
            }
          : undefined,
      });
    }
    return out;
  }, [edges, layers, litIds, hoveredId, traceIds, collapsedByNode, selectedEdgeId]);

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
    (_e: unknown, n: Node) => {
      const cx = n.position.x + NODE_W / 2;
      const cy = n.position.y + NODE_H / 2;
      moveNode(n.id, cx, cy);
      setDragging(null);
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
      className={`overhead-canvas ${hoveredId || traceIds?.length ? "hovering" : ""} ${cardMode ? "cards" : ""} ${tool === "connect" ? "connecting" : ""}`}
    >
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={(_e, n) =>
          moveNode(n.id, n.position.x + NODE_W / 2, n.position.y + NODE_H / 2)
        }
        onNodeDragStop={onNodeDragStop}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("application/overhead-service")) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
          }
        }}
        onDrop={onDrop}
        onNodeClick={(_e, n) => {
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
          if (c.source && c.target) storeAddEdge(c.source, c.target, "sync");
        }}
        isValidConnection={(c) =>
          !!c.source &&
          !!c.target &&
          c.source !== c.target &&
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
