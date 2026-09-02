"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ReactFlow,
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
import { GroupNode } from "./GroupNode";
import { TypedEdge } from "./TypedEdge";
import { GroupFrames } from "./GroupFrames";

const nodeTypes: NodeTypes = { aws: AwsNode, awsGroup: GroupNode };
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

  const groups = useStore((s) => s.groups);

  // Collapsed groups: members hide, one card node appears at their centroid,
  // and edges re-route to it (deduped).
  const collapsedByNode = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of groups) {
      if (!g.collapsed) continue;
      for (const n of nodes) if (n.group === g.id) map.set(n.id, g.id);
    }
    return map;
  }, [groups, nodes]);

  const rfNodes: Node[] = useMemo(() => {
    const visible: Node[] = nodes
      .filter((n) => !collapsedByNode.has(n.id))
      .map((n) => ({
        id: n.id,
        type: "aws",
        position: { x: n.position.x - NODE_W / 2, y: n.position.y - NODE_H / 2 },
        data: { nodeId: n.id },
        className: litIds?.has(n.id) ? "lit" : undefined,
      }));
    for (const g of groups) {
      if (!g.collapsed) continue;
      const members = nodes.filter((n) => n.group === g.id);
      if (!members.length) continue;
      const cx = members.reduce((a, n) => a + n.position.x, 0) / members.length;
      const cy = members.reduce((a, n) => a + n.position.y, 0) / members.length;
      visible.push({
        id: `group:${g.id}`,
        type: "awsGroup",
        position: { x: cx - NODE_W / 2, y: cy - NODE_H / 2 },
        data: { groupId: g.id },
        draggable: false,
      });
    }
    return visible;
  }, [nodes, groups, collapsedByNode, litIds]);

  const rfEdges: Edge[] = useMemo(() => {
    const seen = new Set<string>();
    const out: Edge[] = [];
    for (const e of edges) {
      const from = collapsedByNode.has(e.from)
        ? `group:${collapsedByNode.get(e.from)}`
        : e.from;
      const to = collapsedByNode.has(e.to)
        ? `group:${collapsedByNode.get(e.to)}`
        : e.to;
      if (from === to) continue;
      const rerouted = from !== e.from || to !== e.to;
      const key = `${from}>${to}`;
      if (rerouted) {
        if (seen.has(key)) continue;
        seen.add(key);
      }
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
        },
        className:
          litIds &&
          (traceIds?.length
            ? litIds.has(e.from) && litIds.has(e.to)
            : e.from === hoveredId || e.to === hoveredId)
            ? "lit"
            : undefined,
        markerEnd:
          e.kind === "data"
            ? undefined
            : { type: MarkerType.ArrowClosed, width: 14, height: 14, color: "var(--edge)" },
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

  return (
    <div
      className={`overhead-canvas h-full w-full ${hoveredId || traceIds?.length ? "hovering" : ""} ${cardMode ? "cards" : ""}`}
    >
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeDrag={(_e, n) =>
          moveNode(n.id, n.position.x + NODE_W / 2, n.position.y + NODE_H / 2)
        }
        onNodeDragStop={(_e, n) =>
          moveNode(n.id, n.position.x + NODE_W / 2, n.position.y + NODE_H / 2)
        }
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("application/overhead-service")) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
          }
        }}
        onDrop={onDrop}
        onNodeClick={(_e, n) => select(n.id)}
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
          !c.source.startsWith("group:") &&
          !c.target.startsWith("group:") &&
          !useStore
            .getState()
            .edges.some((e) => e.from === c.source && e.to === c.target)
        }
        connectionRadius={90}
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
        <GroupFrames />
      </ReactFlow>
    </div>
  );
}
