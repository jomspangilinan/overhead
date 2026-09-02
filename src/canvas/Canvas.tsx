"use client";

import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MarkerType,
  type Node,
  type Edge,
  type NodeTypes,
  type EdgeTypes,
} from "@xyflow/react";
import { useStore, cardModeOf, type Layer } from "@/store/useStore";
import type { EdgeKind } from "@/engine/model";
import { AwsNode, NODE_W, NODE_H } from "./AwsNode";
import { TypedEdge } from "./TypedEdge";
import { Lanes } from "./Lanes";

const nodeTypes: NodeTypes = { aws: AwsNode };
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

  const litIds = useMemo(() => {
    if (!hoveredId) return null;
    const lit = new Set<string>([hoveredId]);
    for (const e of edges) {
      if (e.from === hoveredId) lit.add(e.to);
      if (e.to === hoveredId) lit.add(e.from);
    }
    return lit;
  }, [hoveredId, edges]);

  const rfNodes: Node[] = useMemo(
    () =>
      nodes.map((n) => ({
        id: n.id,
        type: "aws",
        position: { x: n.position.x - NODE_W / 2, y: n.position.y - NODE_H / 2 },
        data: { nodeId: n.id },
        className: litIds?.has(n.id) ? "lit" : undefined,
      })),
    [nodes, litIds],
  );

  const rfEdges: Edge[] = useMemo(
    () =>
      edges.map((e) => ({
        id: e.id,
        type: "typed",
        source: e.from,
        target: e.to,
        hidden: !layers[KIND_LAYER[e.kind]],
        data: { kind: e.kind, volumePerMonth: e.volumePerMonth, label: e.label },
        className:
          litIds && (litIds.has(e.from) || litIds.has(e.to)) &&
          (e.from === hoveredId || e.to === hoveredId)
            ? "lit"
            : undefined,
        markerEnd:
          e.kind === "data"
            ? undefined
            : { type: MarkerType.ArrowClosed, width: 14, height: 14, color: "var(--ink)" },
      })),
    [edges, layers, litIds, hoveredId],
  );

  const onMove = useCallback(
    (_evt: unknown, viewport: { zoom: number }) => setZoom(viewport.zoom),
    [setZoom],
  );

  return (
    <div
      className={`overhead-canvas h-full w-full ${hoveredId ? "hovering" : ""} ${cardMode ? "cards" : ""}`}
    >
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeDragStop={(_e, n) =>
          moveNode(n.id, n.position.x + NODE_W / 2, n.position.y + NODE_H / 2)
        }
        onNodeClick={(_e, n) => select(n.id)}
        onPaneClick={() => select(null)}
        onNodeMouseEnter={(_e, n) => hover(n.id)}
        onNodeMouseLeave={() => hover(null)}
        onMove={onMove}
        fitView
        minZoom={0.4}
        maxZoom={2}
        zoomOnScroll={false}
        zoomOnPinch
        panOnScroll
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Lines} gap={24} color="var(--rule)" style={{ opacity: 0.35 }} />
        <Lanes />
      </ReactFlow>
    </div>
  );
}
